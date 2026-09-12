import type Stripe from "stripe";
import { products, type Product, type Tier, tierForSubscriptionStatus } from "@seconds/core";

export const BILLING_APP = "secondbreakfast";
export const isTerminalSubscription = (status: string) => status === "canceled" || status === "incomplete_expired";
export const stripeId = (value: string | { id: string } | null): string | null => typeof value === "string" ? value : value?.id ?? null;

/** A shared Stripe account is not a shared entitlement or customer namespace. */
export function ownsCustomer(customer: Stripe.Customer | Stripe.DeletedCustomer, userId: string, live: boolean): customer is Stripe.Customer {
  return !customer.deleted && customer.livemode === live
    && customer.metadata.app === BILLING_APP && customer.metadata.userId === userId;
}

/** Require one unambiguous server-configured Price and its product's app tag. */
export function productForStripePrice(price: Stripe.Price, priceFor: (id: string) => string | undefined, live: boolean): Product | undefined {
  const matches = products().filter(product => priceFor(product.id) === price.id);
  if (matches.length !== 1 || price.livemode !== live) return;
  const product = matches[0]!;
  const catalogProduct = price.product;
  if (typeof catalogProduct === "string" || catalogProduct.deleted || catalogProduct.livemode !== live || catalogProduct.metadata.app !== BILLING_APP) return;
  if (price.currency !== "usd" || price.unit_amount !== product.cents) return;
  if (product.kind === "plan") {
    if (price.type !== "recurring" || price.recurring?.interval !== "year" || price.recurring.interval_count !== 1 || price.recurring.usage_type !== "licensed") return;
  } else if (price.type !== "one_time" || price.recurring !== null) return;
  return product;
}

export function ownsSubscription(subscription: Stripe.Subscription, userId: string, customerId: string, live: boolean): boolean {
  return subscription.livemode === live && stripeId(subscription.customer) === customerId
    && subscription.metadata.app === BILLING_APP && subscription.metadata.userId === userId;
}

/** Unknown/multi-item plans never infer a paid tier from metadata. */
export function subscriptionTier(subscription: Stripe.Subscription, priceFor: (id: string) => string | undefined, live: boolean): Tier {
  if (subscription.items.has_more || subscription.items.data.length !== 1) return "free";
  const item = subscription.items.data[0]!;
  if (item.quantity !== 1) return "free";
  const product = productForStripePrice(item.price, priceFor, live);
  if (product?.kind !== "plan" || !product.tier) return "free";
  return tierForSubscriptionStatus(subscription.status, product.tier);
}
