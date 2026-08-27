import { eq } from "drizzle-orm";
import type { CreditBalance, Fulfilment, Tier } from "@seconds/core";
import type { Database } from "../client.js";
import * as schema from "../schema.js";
import { creditsFor, grantCredits, setTier } from "./credits.js";

/**
 * Applying what someone paid for.
 *
 * Every function here is written for a caller that will be called more than
 * once with the same input. Stripe retries a webhook until it gets a 2xx, and
 * the network being what it is, a delivery that already succeeded can arrive
 * again. Fulfilment that isn't idempotent hands out free money.
 */

/**
 * Claim an event id, returning false if it was already claimed.
 *
 * The primary key does the work: two concurrent deliveries of the same event
 * race to insert, one wins, and the loser is told to stop. That's stronger
 * than reading first and then writing, which has a window between the two
 * where both callers believe they're first.
 */
export async function claimStripeEvent(
  database: Database,
  eventId: string,
  type: string,
): Promise<boolean> {
  const inserted = await database
    .insert(schema.stripeEvents)
    .values({ id: eventId, type })
    .onConflictDoNothing()
    .returning({ id: schema.stripeEvents.id });

  return inserted.length > 0;
}

/** Has this event already been acted on? For diagnostics, not for gating. */
export async function stripeEventSeen(database: Database, eventId: string): Promise<boolean> {
  const row = await database.query.stripeEvents.findFirst({
    where: eq(schema.stripeEvents.id, eventId),
    columns: { id: true },
  });
  return row !== undefined;
}

/**
 * Give back a claim after fulfilment failed, so Stripe's retry gets a real
 * second attempt instead of being told "already handled."
 *
 * Lives here rather than in the route so it can use the same imports as
 * every other function in this file, instead of a route reaching for a
 * dynamic `import()` to get at the schema and `eq` it already needs.
 */
export async function releaseStripeEvent(database: Database, eventId: string): Promise<void> {
  await database.delete(schema.stripeEvents).where(eq(schema.stripeEvents.id, eventId));
}

export interface PurchaseRecord {
  userId: string;
  productId: string;
  /** What Stripe says was charged, not what we expected to charge. */
  cents: number;
  credits: number;
  tier: Exclude<Tier, "free"> | null;
  stripeSessionId: string | null;
}

/**
 * Apply a completed purchase.
 *
 * Records what was bought before changing the balance, so a failure between
 * the two leaves evidence of a payment that didn't land rather than credits
 * with no explanation. The unique index on the session id means a second
 * attempt at the same purchase can't insert a second row for it.
 *
 * That alone isn't enough, though, because the driver has no interactive
 * transactions: the insert and the fulfilment are separate statements, and a
 * process that dies between them — a dropped connection, a killed
 * container — leaves a purchase row on the books with nothing granted for
 * it. A naive "insert failed to conflict, so we're done" read of that state
 * would mean the retry Stripe sends next treats a stranded row as a finished
 * purchase and grants nothing, forever: the customer paid, the record says
 * so, and they got nothing for it.
 *
 * `fulfilledAt` is what tells the two situations apart. Only a null value
 * means "still owed a grant" — a retry against an unfulfilled row finishes
 * the job instead of skipping it; a retry against a fulfilled one is a
 * genuine duplicate delivery and does nothing, as before.
 *
 * Returns null when the purchase was already fulfilled.
 */
export async function applyPurchase(
  database: Database,
  record: PurchaseRecord,
  fulfilment: Fulfilment,
): Promise<CreditBalance | null> {
  const inserted = await database
    .insert(schema.creditPurchases)
    .values({
      userId: record.userId,
      productId: record.productId,
      cents: record.cents,
      credits: record.credits,
      tier: record.tier,
      stripeSessionId: record.stripeSessionId,
    })
    .onConflictDoNothing()
    .returning({ id: schema.creditPurchases.id, fulfilledAt: schema.creditPurchases.fulfilledAt });

  // The conflict path only fires when a stripeSessionId collides with a row
  // already on file, so looking that row up here can't race with a second
  // insert — the unique index already resolved which attempt "won."
  const purchase =
    inserted[0] ??
    (await database.query.creditPurchases.findFirst({
      where: eq(schema.creditPurchases.stripeSessionId, record.stripeSessionId ?? ""),
      columns: { id: true, fulfilledAt: true },
    }));

  if (!purchase || purchase.fulfilledAt !== null) return null;

  if (fulfilment.grantCredits !== null) {
    await grantCredits(database, record.userId, fulfilment.grantCredits);
  }
  if (fulfilment.setTier !== null) {
    await setTier(database, record.userId, fulfilment.setTier);
  }

  await database
    .update(schema.creditPurchases)
    .set({ fulfilledAt: new Date() })
    .where(eq(schema.creditPurchases.id, purchase.id));

  return creditsFor(database, record.userId);
}

/** Remember Stripe's ids so a returning buyer isn't created as a new customer. */
export async function linkStripeCustomer(
  database: Database,
  userId: string,
  customerId: string,
  subscriptionId?: string | null,
): Promise<void> {
  await database
    .update(schema.users)
    .set({
      stripeCustomerId: customerId,
      ...(subscriptionId === undefined ? {} : { stripeSubscriptionId: subscriptionId }),
    })
    .where(eq(schema.users.id, userId));
}

/**
 * Find the account a subscription belongs to.
 *
 * Subscription webhooks know the subscription, not the user, so the lookup has
 * to run the other way. Falls back to the customer id because the very first
 * event for a new subscription can arrive before the subscription id has been
 * written down.
 */
export async function userForSubscription(
  database: Database,
  subscriptionId: string,
  customerId?: string | null,
): Promise<string | null> {
  const bySubscription = await database.query.users.findFirst({
    where: eq(schema.users.stripeSubscriptionId, subscriptionId),
    columns: { id: true },
  });
  if (bySubscription) return bySubscription.id;

  if (!customerId) return null;
  const byCustomer = await database.query.users.findFirst({
    where: eq(schema.users.stripeCustomerId, customerId),
    columns: { id: true },
  });
  return byCustomer?.id ?? null;
}

/**
 * Move an account to whatever tier its subscription now justifies.
 *
 * Clears the stored subscription id when dropping to free, so a later event
 * for a dead subscription can't be matched back to the account.
 */
export async function applySubscriptionTier(
  database: Database,
  userId: string,
  tier: Tier,
  subscriptionId: string | null,
): Promise<CreditBalance> {
  await database
    .update(schema.users)
    .set({ tier, stripeSubscriptionId: tier === "free" ? null : subscriptionId })
    .where(eq(schema.users.id, userId));

  return creditsFor(database, userId);
}

/** What someone has bought, newest first. */
export async function purchaseHistory(database: Database, userId: string, limit = 50) {
  return database.query.creditPurchases.findMany({
    where: eq(schema.creditPurchases.userId, userId),
    orderBy: (p, { desc }) => [desc(p.createdAt)],
    limit,
  });
}
