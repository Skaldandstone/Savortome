import "server-only";
import type Stripe from "stripe";
import { fulfilmentFor, fulfillableCheckoutProduct } from "@seconds/core";
import { applyPurchase, applySubscriptionTier, lockBillingUser, stripePurchaseFulfilled } from "@seconds/db";
import { priceForProduct } from "./stripe";
import { BILLING_APP, isTerminalSubscription, ownsCustomer, ownsSubscription, productForStripePrice, stripeId, subscriptionTier } from "./stripe-policy";

type Database = Parameters<typeof applyPurchase>[0];
const liveMode = () => process.env.STRIPE_LIVEMODE === "true";
const subscriptionExpand = { expand: ["items.data.price.product"] };

function requireMatch(value: unknown): asserts value {
  if (!value) throw new Error("Stripe billing ownership or catalog mismatch; reconciliation required.");
}

/** Called in the event-claim transaction. Stripe reads follow the account lock. */
export async function fulfillStripeCheckout(database: Database, client: Stripe, snapshot: Stripe.Checkout.Session): Promise<void> {
  if (snapshot.metadata?.app !== BILLING_APP || !snapshot.metadata.userId) return;
  const userId = snapshot.metadata.userId;
  const user = await lockBillingUser(database, userId);
  requireMatch(user);
  if (await stripePurchaseFulfilled(database, snapshot.id)) return;
  const session = await client.checkout.sessions.retrieve(snapshot.id, { expand: ["line_items.data.price.product"] });
  requireMatch(session.id === snapshot.id && session.livemode === liveMode()
    && session.metadata?.app === BILLING_APP && session.metadata.userId === userId);
  if (session.status !== "complete") return;
  const product = fulfillableCheckoutProduct(session);
  if (!product) return;
  const customerId = stripeId(session.customer);
  requireMatch(customerId && user.stripeCustomerId === customerId);
  requireMatch(ownsCustomer(await client.customers.retrieve(customerId), userId, liveMode()));
  const items = session.line_items;
  requireMatch(items && !items.has_more && items.data.length === 1);
  const item = items.data[0]!;
  requireMatch(item.quantity === 1 && item.price
    && productForStripePrice(item.price, priceForProduct, liveMode())?.id === product.id);
  requireMatch(session.mode === (product.kind === "plan" ? "subscription" : "payment")
    && session.currency === "usd" && Number.isSafeInteger(session.amount_total) && session.amount_total! >= 0);

  let subscription: Stripe.Subscription | null = null;
  let applyPlan = false;
  if (product.kind === "plan") {
    const subscriptionId = stripeId(session.subscription);
    requireMatch(subscriptionId);
    subscription = await client.subscriptions.retrieve(subscriptionId, subscriptionExpand);
    requireMatch(ownsSubscription(subscription, userId, customerId, liveMode()));
    applyPlan = !user.stripeSubscriptionId || user.stripeSubscriptionId === subscriptionId;
    if (!applyPlan && !isTerminalSubscription(subscription.status)) {
      const current = await client.subscriptions.retrieve(user.stripeSubscriptionId!, subscriptionExpand);
      requireMatch(ownsSubscription(current, userId, customerId, liveMode()) && isTerminalSubscription(current.status));
      applyPlan = true;
    }
  } else requireMatch(session.subscription === null);

  await applyPurchase(database, {
    userId, productId: product.id, cents: session.amount_total!, credits: product.credits,
    tier: product.tier, stripeSessionId: session.id,
  }, product.kind === "plan" ? { grantCredits: null, setTier: null } : fulfilmentFor(product));
  if (subscription && applyPlan) {
    await applySubscriptionTier(database, userId, subscriptionTier(subscription, priceForProduct, liveMode()), subscription.id, { retainSubscription: true });
  }
}

export async function syncStripeSubscription(database: Database, client: Stripe, snapshot: Stripe.Subscription): Promise<void> {
  if (snapshot.metadata?.app !== BILLING_APP || !snapshot.metadata.userId) return;
  const userId = snapshot.metadata.userId;
  const user = await lockBillingUser(database, userId);
  // Checkout establishes ownership first. Its current-state read covers early
  // events; another subscription's events cannot replace the linked identity.
  if (!user || user.stripeSubscriptionId !== snapshot.id) return;
  const customerId = user.stripeCustomerId;
  requireMatch(customerId && stripeId(snapshot.customer) === customerId);
  requireMatch(ownsCustomer(await client.customers.retrieve(customerId), userId, liveMode()));
  const latest = await client.subscriptions.retrieve(snapshot.id, subscriptionExpand);
  requireMatch(latest.id === snapshot.id && ownsSubscription(latest, userId, customerId, liveMode()));
  // Keep the identity while unpaid/paused so recovery can restore this same
  // subscription. Unknown or multi-item Prices receive no paid entitlement.
  await applySubscriptionTier(database, userId, subscriptionTier(latest, priceForProduct, liveMode()), latest.id, { retainSubscription: true });
}
