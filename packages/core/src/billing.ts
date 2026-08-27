import { CREDIT_PACKS, TIERS, type Tier } from "./credits.js";

/**
 * What can be bought, and what buying it grants.
 *
 * Deliberately free of any payment provider. Everything here is the shape of
 * the decision — which product, how much, what it does to an account — so the
 * rules can be tested without a network, a key, or a sandbox. The Stripe-shaped
 * parts live in the web app, and they consult this.
 *
 * The one rule that matters throughout: **the client never says what something
 * costs.** It names a product; the server looks up the price. Anything else is
 * an invitation to buy 100 credits for a penny.
 */

/** A one-off purchase of credits, or a recurring plan. */
export type PurchaseKind = "pack" | "plan";

export interface PlanPrice {
  tier: Exclude<Tier, "free">;
  /** Whole cents per year. Annual only for now — monthly doubles the surface. */
  cents: number;
}

export const PLAN_PRICES: PlanPrice[] = [
  { tier: "plus", cents: 2999 },
  { tier: "pro", cents: 4999 },
];

export const planPriceFor = (tier: Tier): PlanPrice | undefined =>
  PLAN_PRICES.find((plan) => plan.tier === tier);

/**
 * The identifier a checkout request carries.
 *
 * A string the server can look up, never a number the server trusts. Prefixed
 * so a pack id and a plan id can't be confused for one another by a typo in a
 * query string.
 */
export type ProductId = `pack-${string}` | `plan-${Exclude<Tier, "free">}`;

export const planProductId = (tier: Exclude<Tier, "free">): ProductId => `plan-${tier}`;

export interface Product {
  id: ProductId;
  kind: PurchaseKind;
  cents: number;
  /** Credits granted on purchase. Zero for a plan — a plan changes the allowance. */
  credits: number;
  /** The tier a plan moves someone to. Null for a credit pack. */
  tier: Exclude<Tier, "free"> | null;
}

/** Everything purchasable, derived from the credit and plan tables. */
export function products(): Product[] {
  const packs: Product[] = CREDIT_PACKS.map((pack) => ({
    id: pack.id as ProductId,
    kind: "pack",
    cents: pack.cents,
    credits: pack.credits,
    tier: null,
  }));

  const plans: Product[] = PLAN_PRICES.map((plan) => ({
    id: planProductId(plan.tier),
    kind: "plan",
    cents: plan.cents,
    credits: 0,
    tier: plan.tier,
  }));

  return [...packs, ...plans];
}

/**
 * Look up what was asked for.
 *
 * Returns undefined rather than throwing on an unknown id: a hand-edited
 * checkout URL is a 400, not a crash, and the caller says so in its own words.
 */
export const productById = (id: string): Product | undefined =>
  products().find((product) => product.id === id);

/**
 * What a completed payment does to an account.
 *
 * Pure, so the consequences of a webhook can be tested without one. Returns the
 * two things fulfilment can do — grant credits, move a tier — and the caller
 * applies whichever are non-null.
 */
export interface Fulfilment {
  grantCredits: number | null;
  setTier: Exclude<Tier, "free"> | null;
}

export function fulfilmentFor(product: Product): Fulfilment {
  return {
    grantCredits: product.credits > 0 ? product.credits : null,
    setTier: product.tier,
  };
}

/**
 * Which Stripe events are worth acting on.
 *
 * An allow-list rather than a switch with a default, because the interesting
 * failure is a new event type quietly taking a code path meant for another.
 * Everything not named here is acknowledged and ignored — Stripe sends a great
 * many events, and a 200 saying "understood, did nothing" is the correct answer
 * to almost all of them.
 */
export const HANDLED_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.deleted",
  "customer.subscription.updated",
] as const;

export type HandledEvent = (typeof HANDLED_EVENTS)[number];

export const isHandledEvent = (type: string): type is HandledEvent =>
  (HANDLED_EVENTS as readonly string[]).includes(type);

/**
 * The tier a subscription in a given Stripe status should confer.
 *
 * `past_due` deliberately keeps the paid tier. A card that failed at 3am is
 * usually a card that will succeed on retry, and taking someone's library
 * features away over it costs far more goodwill than a few days of unpaid
 * access costs money. `canceled` and `unpaid` drop to free.
 */
export function tierForSubscriptionStatus(
  status: string,
  tier: Exclude<Tier, "free">,
): Tier {
  if (status === "active" || status === "trialing" || status === "past_due") return tier;
  return "free";
}

/** Guard for a tier arriving from outside — Stripe metadata, a query string. */
export const isPayableTier = (value: unknown): value is Exclude<Tier, "free"> =>
  typeof value === "string" && value !== "free" && (TIERS as readonly string[]).includes(value);

/** "$29.99" — every price in this module is whole cents. */
export const formatCents = (cents: number): string => `$${(cents / 100).toFixed(2)}`;
