import { and, desc, eq, gte, ilike, isNotNull, isNull, ne, sql } from "drizzle-orm";
import * as schema from "../schema.js";
import type { Database } from "../client.js";

/**
 * Read helpers for the staff-only admin routes (see apps/web/app/api/admin).
 * Kept beside the other query modules so route handlers stay free of raw
 * drizzle, matching the rest of the codebase.
 */

export async function searchUsersByEmail(database: Database, email: string, limit = 20) {
  return database
    .select({
      id: schema.users.id,
      email: schema.users.email,
      handle: schema.users.handle,
      displayName: schema.users.displayName,
      tier: schema.users.tier,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .where(ilike(schema.users.email, `%${email}%`))
    .limit(limit);
}

export async function adminUserById(database: Database, userId: string) {
  return database.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: {
      id: true,
      clerkId: true,
      email: true,
      handle: true,
      displayName: true,
      tier: true,
      creditsPurchased: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      createdAt: true,
    },
  });
}

export async function recentImportsFor(database: Database, userId: string, limit = 10) {
  return database
    .select({
      id: schema.imports.id,
      url: schema.imports.url,
      status: schema.imports.status,
      error: schema.imports.error,
      trace: schema.imports.trace,
      createdAt: schema.imports.createdAt,
      finishedAt: schema.imports.finishedAt,
    })
    .from(schema.imports)
    .where(eq(schema.imports.userId, userId))
    .orderBy(desc(schema.imports.createdAt))
    .limit(limit);
}

/**
 * Failed imports across all users, grouped by their error string. This is the
 * "is one thing broken or are these unrelated bugs" view — a spike in one
 * bucket means an upstream resolver broke, scattered singletons mean per-recipe
 * problems. Support's first stop when import complaints come in.
 */
export async function failedImportBuckets(database: Database, sinceHours = 48, limit = 30) {
  const since = new Date(Date.now() - sinceHours * 3600_000);
  return database
    .select({
      error: schema.imports.error,
      count: sql<number>`cast(count(*) as int)`,
      lastAt: sql<Date>`max(${schema.imports.createdAt})`,
    })
    .from(schema.imports)
    .where(and(eq(schema.imports.status, "failed"), gte(schema.imports.createdAt, since)))
    .groupBy(schema.imports.error)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);
}

/**
 * Recent free-text reviews across all users — the primary UGC surface a
 * moderator scans. Only rows that actually carry review text are returned.
 */
export async function recentReviews(database: Database, limit = 50) {
  return database
    .select({
      userId: schema.ratings.userId,
      recipeId: schema.ratings.recipeId,
      stars: schema.ratings.stars,
      review: schema.ratings.review,
      hiddenAt: schema.ratings.hiddenAt,
      createdAt: schema.ratings.createdAt,
      authorEmail: schema.users.email,
      authorHandle: schema.users.handle,
    })
    .from(schema.ratings)
    .innerJoin(schema.users, eq(schema.users.id, schema.ratings.userId))
    .where(and(isNotNull(schema.ratings.review), ne(schema.ratings.review, "")))
    .orderBy(desc(schema.ratings.createdAt))
    .limit(limit);
}

/** One purchase, for the refund flow. Null if it isn't this user's. */
export async function purchaseForRefund(database: Database, userId: string, purchaseId: string) {
  const row = await database.query.creditPurchases.findFirst({
    where: and(eq(schema.creditPurchases.id, purchaseId), eq(schema.creditPurchases.userId, userId)),
    columns: {
      id: true, cents: true, credits: true, stripeSessionId: true,
      fulfilledAt: true, refundedAt: true, refundedCents: true, productId: true,
    },
  });
  return row ?? null;
}

/** Purchases with their refund state, for the admin billing view. */
export async function adminPurchases(database: Database, userId: string, limit = 25) {
  return database
    .select({
      id: schema.creditPurchases.id,
      productId: schema.creditPurchases.productId,
      cents: schema.creditPurchases.cents,
      credits: schema.creditPurchases.credits,
      stripeSessionId: schema.creditPurchases.stripeSessionId,
      fulfilledAt: schema.creditPurchases.fulfilledAt,
      refundedAt: schema.creditPurchases.refundedAt,
      refundedCents: schema.creditPurchases.refundedCents,
      createdAt: schema.creditPurchases.createdAt,
    })
    .from(schema.creditPurchases)
    .where(eq(schema.creditPurchases.userId, userId))
    .orderBy(desc(schema.creditPurchases.createdAt))
    .limit(limit);
}

/**
 * Atomically claim a purchase for refund BEFORE any money moves. The
 * conditional `WHERE refunded_at IS NULL` means only one caller can win, so a
 * double-click or concurrent refund can't reach Stripe twice. Returns true if
 * this call claimed it; false if it was already claimed/refunded.
 *
 * The external Stripe request cannot be rolled back by a database transaction.
 * This flow claims first, then requests the refund, then finalizes the database
 * updates in a transaction, or releases the claim if the Stripe request fails.
 * Interrupted external requests still require reconciliation.
 */
export async function claimRefund(database: Database, purchaseId: string): Promise<boolean> {
  const rows = await database
    .update(schema.creditPurchases)
    .set({ refundedAt: new Date() })
    .where(and(eq(schema.creditPurchases.id, purchaseId), isNull(schema.creditPurchases.refundedAt)))
    .returning({ id: schema.creditPurchases.id });
  return rows.length > 0;
}

/** Undo a claim when the Stripe refund itself failed, so it can be retried. */
export async function releaseRefundClaim(database: Database, purchaseId: string) {
  await database
    .update(schema.creditPurchases)
    .set({ refundedAt: null })
    .where(eq(schema.creditPurchases.id, purchaseId));
}

/**
 * Finalize a claimed refund: record the amount and claw back unspent credits.
 * `clawback` is the caller-computed still-unspent purchased credits to remove
 * (never more than the balance, so it can't drive it negative).
 */
export async function finalizeRefund(
  database: Database,
  userId: string,
  purchaseId: string,
  refundedCents: number,
  clawback: number,
) {
  await database.transaction(async (tx) => {
    await tx
      .update(schema.creditPurchases)
      .set({ refundedCents })
      .where(eq(schema.creditPurchases.id, purchaseId));
    await tx
      .update(schema.users)
      .set({ creditsPurchased: sql`greatest(0, ${schema.users.creditsPurchased} - ${clawback})` })
      .where(eq(schema.users.id, userId));
  });
}

/** Set a user's moderation state (active | suspended | banned). Reversible. */
export async function setUserStatus(
  database: Database,
  userId: string,
  status: "active" | "suspended" | "banned",
) {
  const [row] = await database
    .update(schema.users)
    .set({ status })
    .where(eq(schema.users.id, userId))
    .returning({ id: schema.users.id, status: schema.users.status });
  return row ?? null;
}

/** Hide or unhide a review's free text (soft; the row and stars stay). */
export async function setReviewHidden(
  database: Database,
  userId: string,
  recipeId: string,
  hidden: boolean,
) {
  const [row] = await database
    .update(schema.ratings)
    .set({ hiddenAt: hidden ? new Date() : null })
    .where(and(eq(schema.ratings.userId, userId), eq(schema.ratings.recipeId, recipeId)))
    .returning({ userId: schema.ratings.userId, recipeId: schema.ratings.recipeId, hiddenAt: schema.ratings.hiddenAt });
  return row ?? null;
}
