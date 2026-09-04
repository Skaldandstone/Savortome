import type { ExtractionMethod } from "./recipe.js";

/**
 * AI credits — what a plan includes, and what spends one.
 *
 * Almost everything in this app costs nothing to serve. Storing a recipe,
 * planning a week, sorting a shopping list, cooking from a card: all free at
 * the margin. One thing isn't. Asking a model to read a video transcript or an
 * unstructured blog post costs real money every single time, and it's the only
 * action in the product that does.
 *
 * So that action, and only that action, is metered. A credit is one AI import.
 * Nothing else spends one — which is why the counter can be shown to someone
 * without it feeling like a taxi meter running on the whole app.
 */

/**
 * Plan identifiers, kept deliberately boring.
 *
 * These are stored in Postgres as an enum, so changing one is a migration.
 * The names people actually see live in `TIER_LABEL` below and can be changed
 * freely — marketing names and database values have no business being the same
 * string.
 */
export const TIERS = ["free", "plus", "pro"] as const;
export type Tier = (typeof TIERS)[number];

/**
 * Display names. Nothing else depends on these — renaming is a one-line change.
 *
 * Hobbit meals, to match the app's own name. The one weakness of the set is
 * that the ordering isn't self-evident unless you know the reference, so
 * anywhere a tier is named it should be shown next to its credit count. The
 * number does the ranking; the name does the personality.
 */
export const TIER_LABEL: Record<Tier, string> = {
  free: "Elevenses",
  plus: "Luncheon",
  pro: "Feast",
};

/**
 * Credits included each month, by plan.
 *
 * Sized so that a subscriber who burns every credit every month is still
 * profitable on the current extraction pipeline. That's the whole point of a
 * cap: the worst case is a number you can work out in advance rather than
 * something you discover from a bill.
 *
 * Measured against the live API across four transcripts (Opus 5, effort
 * "medium", 1h cache): $0.061-0.234/import depending on cache state and
 * transcript length, averaging ~$0.12 — about $0.059/credit-unit once split
 * across the 2 credits a transcript costs. The 1h cache genuinely gets hit
 * in back-to-back imports, not just in theory. Worst *observed* single
 * import was $0.166 ($0.083/credit); at that rate Plus's worst case (25
 * credits, all video) runs ~$2.08/month against $2.50 of revenue, and Pro's
 * (50 credits, all video) breaks roughly even against $4.17 — but the
 * average case, which is what a real subscriber mix actually looks like,
 * clears both with real margin (~$1.47 and ~$2.95/month respectively).
 * Re-measure if the extraction prompt or model changes meaningfully; four
 * samples is a sanity check, not a bulletproof guarantee.
 *
 * These are floors, not ambitions. Raising them later is an announcement
 * people enjoy; lowering them is why people leave.
 */
export const TIER_ALLOWANCE: Record<Tier, number> = {
  free: 3,
  plus: 25,
  pro: 50,
};

export const isTier = (value: string | null | undefined): value is Tier =>
  typeof value === "string" && (TIERS as readonly string[]).includes(value);

/** Unknown or missing plans read as free rather than throwing. */
export const tierOr = (value: string | null | undefined): Tier => (isTier(value) ? value : "free");

/**
 * How many credits does this extraction spend?
 *
 * Only the paths that actually call a model cost anything. A page publishing
 * its own schema.org recipe is read directly and costs nothing, so charging
 * for it would be inventing a cost to bill for. Typing a recipe in by hand
 * obviously costs nothing either.
 *
 * A transcript costs 2, not 1. Measured against the live API, reconstructing
 * a recipe from a messy auto-generated transcript runs 2-3x the model spend
 * of a clean blog article or a caption — more input to read, and far more
 * thinking to untangle misheard words, gestured amounts, and steps described
 * out of order. Pricing every source the same would make the cheap case
 * subsidize the expensive one; every subscriber pays for video whether they
 * import any or not. Splitting the cost keeps a plan's advertised allowance
 * true in the worst case — someone who spends every credit on video — not
 * just on the average mix.
 *
 * Pantry search doesn't appear here at all: it's a different action, it's
 * roughly a fifteenth of the price of an import, and metering it would make
 * the cheapest feature in the app feel like the most expensive.
 */
export function creditCost(method: ExtractionMethod): number {
  if (method === "schema-org" || method === "manual") return 0;
  // A photo is one bounded image, closer in cost to an article than to a
  // multi-minute transcript — standard rate, not the transcript's double.
  return method === "transcript-llm" ? 2 : 1;
}

/** Whether this extraction spends anything at all. */
export function costsCredit(method: ExtractionMethod): boolean {
  return creditCost(method) > 0;
}

/**
 * The month a spend belongs to, as `YYYY-MM` in UTC.
 *
 * A plain string rather than a date range because the only question ever asked
 * of it is "same month?", and UTC because an allowance that resets at a
 * different instant depending on where someone is standing is a support ticket
 * waiting to happen.
 */
export function creditMonth(at: Date = new Date()): string {
  return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** When the monthly allowance next resets, as an ISO date. */
export function nextResetISO(at: Date = new Date()): string {
  const next = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth() + 1, 1));
  return next.toISOString().slice(0, 10);
}

/** The raw counts a balance is derived from — one row's worth of database. */
export interface CreditUsage {
  tier: Tier;
  /** Allowance credits already spent this month. */
  allowanceUsed: number;
  /** Every credit ever bought. Purchased credits don't expire. */
  purchased: number;
  /** Purchased credits already spent, across all time. */
  purchasedUsed: number;
}

export interface CreditBalance {
  tier: Tier;
  allowance: number;
  allowanceUsed: number;
  allowanceLeft: number;
  purchasedLeft: number;
  /** What's actually available to spend right now. */
  total: number;
  canSpend: boolean;
  /** Which pool the next import would draw from. */
  nextFrom: "allowance" | "purchased" | null;
}

/**
 * Work out what someone can spend.
 *
 * The monthly allowance is spent before purchased credits, always. The
 * allowance expires at the end of the month and purchased credits never do, so
 * spending the perishable one first is simply the arithmetic that loses the
 * customer the least. Clamped at zero throughout: a tier downgrade can leave
 * someone having used more than their new allowance, and that should read as
 * "none left", not as a negative number.
 */
export function creditBalance(usage: CreditUsage): CreditBalance {
  const allowance = TIER_ALLOWANCE[usage.tier];
  const allowanceUsed = Math.max(0, usage.allowanceUsed);
  const allowanceLeft = Math.max(0, allowance - allowanceUsed);
  const purchasedLeft = Math.max(0, usage.purchased - usage.purchasedUsed);
  const total = allowanceLeft + purchasedLeft;

  return {
    tier: usage.tier,
    allowance,
    allowanceUsed,
    allowanceLeft,
    purchasedLeft,
    total,
    canSpend: total > 0,
    nextFrom: allowanceLeft > 0 ? "allowance" : purchasedLeft > 0 ? "purchased" : null,
  };
}

/**
 * What to say about someone's remaining credits.
 *
 * Says the number plainly. A count that's about to block someone mid-task is
 * information they want early, not a surprise at the moment they paste a link.
 */
export function describeCredits(balance: CreditBalance): string {
  if (balance.total === 0) return "No AI imports left this month";

  const parts = [`${balance.total} AI ${balance.total === 1 ? "import" : "imports"} left`];
  if (balance.purchasedLeft > 0 && balance.allowanceLeft > 0) {
    parts.push(`(${balance.allowanceLeft} this month, ${balance.purchasedLeft} topped up)`);
  } else if (balance.purchasedLeft > 0) {
    parts.push("(topped up)");
  }
  return parts.join(" ");
}

/**
 * Why an import was refused, in words that say what to do next.
 *
 * A free user and a paying one who has run out need different sentences: one
 * should hear about upgrading, the other about topping up. Telling a paying
 * customer to "upgrade" when they already have is how you lose them.
 */
export function outOfCreditsMessage(balance: CreditBalance, resetISO: string): string {
  const when = `Your ${TIER_ALLOWANCE[balance.tier]} monthly credits reset on ${resetISO}.`;
  const recipes = "Recipes from sites that publish their own recipe data are always free, and never use a credit.";

  return balance.tier === "free"
    ? `You've used your free AI imports. ${when} ${recipes}`
    : `You've used every AI import on your plan. ${when} You can top up to keep going. ${recipes}`;
}

/** Top-up packs. Priced to be profitable on any extraction pipeline. */
export interface CreditPack {
  id: string;
  credits: number;
  /** Price in whole cents, because floating-point money is a bug waiting to happen. */
  cents: number;
}

export const CREDIT_PACKS: CreditPack[] = [
  { id: "pack-25", credits: 25, cents: 299 },
  // 11.0c a credit against the small pack's 12.0c. A bigger pack that isn't
  // better value is just a more expensive pack, and nobody buys it.
  { id: "pack-100", credits: 100, cents: 1099 },
];

export const packById = (id: string): CreditPack | undefined =>
  CREDIT_PACKS.find((pack) => pack.id === id);

/** "$2.99" — packs are priced in cents and shown in dollars. */
/** "$29.99" — everything in this module is priced in whole cents. */
export const formatCents = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

export const formatPackPrice = (pack: CreditPack): string => formatCents(pack.cents);
