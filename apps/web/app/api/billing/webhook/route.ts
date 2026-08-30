import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  fulfilmentFor,
  fulfillableCheckoutProduct,
  isHandledEvent,
  isPayableTier,
  tierForSubscriptionStatus,
} from "@seconds/core";
import {
  applyPurchase,
  applySubscriptionTier,
  claimStripeEvent,
  db,
  linkStripeCustomer,
  userForSubscription,
} from "@seconds/db";
import { requireWebhookSecret, stripe, stripeConfigured, webhookConfigured } from "@/lib/stripe";
import { databaseConfigured } from "@/lib/session";

/**
 * Where a payment actually becomes credits.
 *
 * Three rules govern everything in this file, and all three exist because this
 * is the one endpoint on the internet that can give away money.
 *
 * **Verify the signature first.** The body is untrusted until Stripe's own
 * signature says otherwise. Without that check this route is a form anyone can
 * post to in order to grant themselves a subscription.
 *
 * **Fulfil here, not on the success redirect.** A browser redirect can be
 * missed, replayed, or forged, and someone who closes the tab has still paid.
 * The webhook is the only delivery that is guaranteed and authenticated.
 *
 * **Act once.** Stripe retries until it gets a 2xx, so the same event will
 * arrive more than once in normal operation. Every path here claims the event
 * id before doing anything, and a claim that fails means someone already did.
 */
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!stripeConfigured() || !webhookConfigured()) {
    return NextResponse.json(
      { error: "Stripe isn't configured. Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET." },
      { status: 501 },
    );
  }
  if (!databaseConfigured()) {
    // A 500 rather than a 501: Stripe should retry this one, because the
    // payment is real and the fulfilment is merely postponed.
    return NextResponse.json({ error: "No database to record the purchase in." }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature." }, { status: 400 });
  }

  // The raw body, byte for byte. Parsing it first and re-serialising would
  // change the bytes and the signature would never verify.
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(payload, signature, requireWebhookSecret());
  } catch (err) {
    // A bad signature is not a retryable condition, so 400 rather than 500 —
    // telling Stripe to stop rather than to try the same forgery again.
    return NextResponse.json(
      { error: `Signature verification failed: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 400 },
    );
  }

  if (event.livemode !== (process.env.STRIPE_LIVEMODE === "true")) {
    return NextResponse.json({ error: "Stripe environment does not match." }, { status: 400 });
  }

  // Anything not on the allow-list is understood and deliberately ignored.
  // Stripe sends a great many events and a 200 is the correct answer to most.
  if (!isHandledEvent(event.type)) {
    return NextResponse.json({ received: true, handled: false, type: event.type });
  }

  try {
    const handled = await db().transaction(async (database) => {
      // The claim and fulfilment commit together, including after process loss.
      if (!(await claimStripeEvent(database, event.id, event.type))) return false;
      switch (event.type) {
        case "checkout.session.completed":
        case "checkout.session.async_payment_succeeded":
          await onCheckoutCompleted(database, event.data.object);
          break;
        case "checkout.session.async_payment_failed":
          // No grant has occurred while payment was pending. Nothing to revoke.
          break;
        case "customer.subscription.updated":
        case "customer.subscription.deleted":
          await onSubscriptionChanged(database, event.data.object);
          break;
      }
      return true;
    });
    return NextResponse.json({ received: true, handled, ...(!handled ? { duplicate: true } : {}) });
  } catch (err) {
    // Rollback releases the claim as well as any partial grant.
    console.error(`Stripe webhook fulfilment failed for ${event.id} (${event.type}):`, err);
    return NextResponse.json(
      { error: "Fulfilment failed. Please retry." },
      { status: 500 },
    );
  }
}

/** A one-off pack, or the first payment of a subscription. */
async function onCheckoutCompleted(
  database: Parameters<typeof applyPurchase>[0],
  session: Stripe.Checkout.Session,
): Promise<void> {
  const userId = session.metadata?.userId;
  const productId = session.metadata?.productId;
  if (!userId || !productId) return;

  const product = fulfillableCheckoutProduct(session);
  if (!product) return;

  const customerId = typeof session.customer === "string" ? session.customer : null;
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
  if (customerId) await linkStripeCustomer(database, userId, customerId, subscriptionId ?? undefined);

  await applyPurchase(
    database,
    {
      userId,
      productId: product.id,
      // What Stripe says was charged, not what we expected. A discount code or
      // a currency conversion makes those different, and the ledger should
      // record what actually happened.
      cents: session.amount_total ?? product.cents,
      credits: product.credits,
      tier: product.tier,
      stripeSessionId: session.id,
    },
    fulfilmentFor(product),
  );
}

/** A plan renewed, lapsed, changed, or was cancelled. */
async function onSubscriptionChanged(
  database: Parameters<typeof applyPurchase>[0],
  subscription: Stripe.Subscription,
): Promise<void> {
  if (subscription.metadata?.app !== "secondbreakfast") return;
  const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
  const userId =
    subscription.metadata?.userId ??
    (await userForSubscription(database, subscription.id, customerId));
  if (!userId) return;

  // Which plan this subscription is for, taken from metadata written at
  // checkout. Most updates carry no plan-change intent at all — a proration,
  // a payment-method swap, a renewal — so a missing or unrecognised value
  // must NOT be read as "downgrade to the cheapest plan". That would
  // silently take features away from someone still being billed at the
  // higher price, on every renewal, with nothing in the logs to explain why.
  // The safe reading of "we don't know what plan this is" is "leave the
  // account's tier as it already is."
  const metaTier = subscription.metadata?.productId?.replace(/^plan-/, "");
  const current = await database.query.users.findFirst({
    where: (u, { eq }) => eq(u.id, userId),
    columns: { tier: true },
  });
  const knownTier = isPayableTier(current?.tier) ? current.tier : "plus";

  if (!isPayableTier(metaTier)) {
    console.error(
      `Stripe subscription ${subscription.id} has no resolvable plan in metadata` +
        ` (got ${JSON.stringify(metaTier)}) — keeping the account's current tier` +
        ` (${knownTier}) rather than guessing.`,
    );
  }
  const paidTier = isPayableTier(metaTier) ? metaTier : knownTier;

  await applySubscriptionTier(
    database,
    userId,
    tierForSubscriptionStatus(subscription.status, paidTier),
    subscription.id,
  );
}

