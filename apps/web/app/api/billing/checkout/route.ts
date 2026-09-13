import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { productById } from "@seconds/core";
import { linkStripeCustomer, lockBillingUser } from "@seconds/db";
import { BadRequestError, readJson, withUser } from "@/lib/api";
import { appOrigin, priceForProduct, stripe, stripeConfigured, trustedBillingOrigin, webhookConfigured } from "@/lib/stripe";
import { BILLING_APP, isTerminalSubscription, ownsCustomer, ownsSubscription, productForStripePrice } from "@/lib/stripe-policy";

/**
 * Start a checkout.
 *
 * The request names a product; the server decides what it costs. The client
 * never sends a price, a credit count, or a tier — those are looked up here
 * from the one table that defines them, because a client that can name its own
 * price will eventually name zero.
 */
export const runtime = "nodejs";

// Generated once for this integration; keep stable across requests and deploys.
const CHECKOUT_INTEGRATION_IDENTIFIER = "secondbreakfast-web-checkout-fpkhuarf";

export async function POST(request: Request) {
  if (!trustedBillingOrigin(request)) {
    return NextResponse.json({ error: "Billing requests must come from Savortome." }, { status: 403 });
  }
  if (process.env.STRIPE_CHECKOUT_ENABLED !== "true") {
    return NextResponse.json({ error: "Checkout is not enabled for this beta." }, { status: 403 });
  }
  const body = await readJson<{ productId?: string }>(request);
  const product = body && typeof body.productId === "string" ? productById(body.productId) : undefined;

  if (!product) {
    return NextResponse.json(
      { error: "That isn't something you can buy." },
      { status: 400 },
    );
  }

  const price = priceForProduct(product.id);
  if (!stripeConfigured() || !webhookConfigured() || !price) {
    return NextResponse.json(
      {
        error:
          "Payments aren't set up yet. Configure the Stripe key, webhook, and product price.",
      },
      { status: 501 },
    );
  }

  return withUser(async (userId, database) => database.transaction(async transaction => {
    const client = stripe();
    const origin = appOrigin();
    const live = process.env.STRIPE_LIVEMODE === "true";
    const user = await lockBillingUser(transaction, userId);
    if (!user) throw new BadRequestError("Your billing account is unavailable.");
    const catalogPrice = await client.prices.retrieve(price, { expand: ["product"] });
    if (!catalogPrice.active || productForStripePrice(catalogPrice, priceForProduct, live)?.id !== product.id) {
      throw new BadRequestError("This payment option is not configured correctly yet.");
    }

    // Reuse the customer so someone's purchases stay on one record in Stripe
    // rather than scattering across a new customer per checkout.
    const customer = user.stripeCustomerId
      ? await client.customers.retrieve(user.stripeCustomerId)
      : await client.customers.create({ metadata: { app: BILLING_APP, userId } }, {
        // Stable parameters survive a DB rollback or a changed account email.
        idempotencyKey: `secondbreakfast-customer-${createHash("sha256").update(userId).digest("hex")}`,
      });
    if (!ownsCustomer(customer, userId, live)) throw new BadRequestError("Your billing link needs support before it can be used.");
    const customerId = customer.id;
    if (customerId !== user.stripeCustomerId) {
      await linkStripeCustomer(transaction, userId, customerId);
    }

    const isPlan = product.kind === "plan";
    if (isPlan) {
      // Check current Stripe state, including subscriptions whose Checkout
      // webhook has not arrived. Never start another recurring charge blindly.
      const subscriptions = await client.subscriptions.list({ customer: customerId, status: "all", limit: 100 });
      if (subscriptions.has_more || subscriptions.data.some(subscription =>
        !ownsSubscription(subscription, userId, customerId, live) || !isTerminalSubscription(subscription.status))) {
        throw new BadRequestError("A subscription already exists. Use Manage billing, or contact support.");
      }
      const open = await client.checkout.sessions.list({ customer: customerId, status: "open", limit: 100 });
      if (open.has_more) throw new BadRequestError("An existing checkout needs support before another can be opened.");
      const pending = open.data.filter(session => session.mode === "subscription");
      if (pending.length) {
        const existing = pending[0]!;
        if (pending.length === 1 && existing.metadata?.app === BILLING_APP && existing.metadata.userId === userId
          && existing.metadata.productId === product.id && existing.url) return { url: existing.url };
        throw new BadRequestError("A plan checkout is already open. Finish it or wait for it to expire.");
      }
    }
    const metadata = { app: "secondbreakfast", userId, productId: product.id };

    const session = await client.checkout.sessions.create({
      integration_identifier: CHECKOUT_INTEGRATION_IDENTIFIER,
      mode: isPlan ? "subscription" : "payment",
      // The existing purchase ledger stores USD cents only.
      adaptive_pricing: { enabled: false },
      customer: customerId,
      line_items: [{ quantity: 1, price }],
      // Fulfilment reads these back off the webhook. The userId matters most:
      // the webhook arrives with no session of its own.
      metadata,
      ...(isPlan ? { subscription_data: { metadata } } : {}),
      success_url: `${origin}/?checkout=done`,
      cancel_url: `${origin}/?checkout=cancelled`,
    });

    if (!session.url) throw new Error("Checkout did not return a hosted URL.");
    return { url: session.url };
  }).catch(error => {
    // The shared API error logger must not receive Stripe response/customer data.
    if (error instanceof BadRequestError) throw error;
    throw new Error("Billing checkout is temporarily unavailable.");
  }));
}
