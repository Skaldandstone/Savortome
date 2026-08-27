import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  fulfilmentFor,
  isHandledEvent,
  isPayableTier,
  productById,
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

  // Anything not on the allow-list is understood and deliberately ignored.
  // Stripe sends a great many events and a 200 is the correct answer to most.
  if (!isHandledEvent(event.type)) {
    return NextResponse.json({ received: true, handled: false, type: event.type });
  }

  const database = db();

  // Claimed before any work: two concurrent deliveries race to insert, one
  // wins, and the loser stops. Checking first and writing after would leave a
  // window in which both believe they are the first.
  if (!(await claimStripeEvent(database, event.id, event.type))) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await onCheckoutCompleted(database, event.data.object);
        break;
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await onSubscriptionChanged(database, event.data.object);
        break;
    }
  } catch (err) {
    // A 500 asks Stripe to retry. The event id is already claimed, so the
    // retry would be treated as a duplicate and do nothing — which is why the
    // claim is released here, so a genuine transient failure gets its retry.
    await releaseClaim(database, event.id);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fulfilment failed." },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true, handled: true });
}

/** A one-off pack, or the first payment of a subscription. */
async function onCheckoutCompleted(
  database: ReturnType<typeof db>,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const userId = session.metadata?.userId;
  const productId = session.metadata?.productId;
  if (!userId || !productId) return;

  const product = productById(productId);
  if (!product) return;

  const customerId = typeof session.customer === "string" ? session.customer : null;
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : null;
  if (customerId) await linkStripeCustomer(database, userId, customerId, subscriptionId);

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
  database: ReturnType<typeof db>,
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
  const userId =
    subscription.metadata?.userId ??
    (await userForSubscription(database, subscription.id, customerId));
  if (!userId) return;

  // Which plan this subscription is for, taken from metadata written at
  // checkout. An unrecognised value falls back to the lowest paid tier rather
  // than guessing upward — being wrong should cost the customer nothing and
  // the business a little, never the other way round.
  const metaTier = subscription.metadata?.productId?.replace(/^plan-/, "");
  const paidTier = isPayableTier(metaTier) ? metaTier : "plus";

  await applySubscriptionTier(
    database,
    userId,
    tierForSubscriptionStatus(subscription.status, paidTier),
    subscription.id,
  );
}

/** Let a failed delivery be retried by giving back the event id. */
async function releaseClaim(database: ReturnType<typeof db>, eventId: string): Promise<void> {
  try {
    const { schema } = await import("@seconds/db");
    const { eq } = await import("drizzle-orm");
    await database.delete(schema.stripeEvents).where(eq(schema.stripeEvents.id, eventId));
  } catch {
    // If the release fails the event stays claimed and the retry no-ops. That
    // loses one fulfilment, which is recoverable from the Stripe dashboard;
    // throwing here would lose the error that caused it, which isn't.
  }
}
