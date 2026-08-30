import { and, eq, sql } from "drizzle-orm";
import {
  costsCredit,
  creditBalance,
  creditMonth,
  tierOr,
  type CreditBalance,
  type ExtractionMethod,
  type Tier,
} from "@seconds/core";
import type { Database as ConnectionDatabase } from "../client.js";
import * as schema from "../schema.js";

type Database = Pick<ConnectionDatabase, "select" | "insert" | "update">;

/**
 * Reading and spending AI credits.
 *
 * The balance is never stored. It's derived from the ledger every time, which
 * costs an indexed count and buys the property that matters most here: there is
 * no number that can drift away from the rows explaining it. When someone asks
 * why they have 12 credits left, the answer is a list of imports.
 */

export class OutOfCreditsError extends Error {
  readonly balance: CreditBalance;
  constructor(message: string, balance: CreditBalance) {
    super(message);
    this.name = "OutOfCreditsError";
    this.balance = balance;
  }
}

/** What someone can spend right now. */
export async function creditsFor(
  database: Database,
  userId: string,
  now: Date = new Date(),
): Promise<CreditBalance> {
  const month = creditMonth(now);

  const [user, allowanceRow, purchasedRow] = await Promise.all([
    database
      .select({ tier: schema.users.tier, purchased: schema.users.creditsPurchased })
      .from(schema.users)
      .where(eq(schema.users.id, userId)),
    database
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.creditSpends)
      .where(
        and(
          eq(schema.creditSpends.userId, userId),
          eq(schema.creditSpends.month, month),
          eq(schema.creditSpends.source, "allowance"),
        ),
      ),
    database
      .select({ n: sql<number>`count(*)::int` })
      .from(schema.creditSpends)
      .where(
        and(eq(schema.creditSpends.userId, userId), eq(schema.creditSpends.source, "purchased")),
      ),
  ]);

  return creditBalance({
    tier: tierOr(user[0]?.tier),
    allowanceUsed: allowanceRow[0]?.n ?? 0,
    purchased: user[0]?.purchased ?? 0,
    purchasedUsed: purchasedRow[0]?.n ?? 0,
  });
}

/**
 * Check before doing expensive work.
 *
 * Called before the import runs, so someone out of credits is told in a second
 * rather than after a thirty-second video fetch. This is a courtesy check, not
 * the enforcement — see `spendCredit`.
 */
export async function canSpendCredit(
  database: Database,
  userId: string,
  method: ExtractionMethod,
  now: Date = new Date(),
): Promise<boolean> {
  if (!costsCredit(method)) return true;
  return (await creditsFor(database, userId, now)).canSpend;
}

/**
 * Record a credit spend, after the model call has already happened.
 *
 * Written after rather than before on purpose. A failed extraction that had
 * already taken a credit would charge someone for nothing, and refunding is
 * more moving parts than not charging in the first place. The exposure that
 * buys is bounded — at worst a few concurrent imports slip past a nearly-empty
 * balance, which costs cents, where a wrongly-charged customer costs trust.
 *
 * Returns null when the method is free, so callers don't have to ask twice.
 */
export async function spendCredit(
  database: Database,
  userId: string,
  method: ExtractionMethod,
  recipeId: string | null,
  now: Date = new Date(),
): Promise<CreditBalance | null> {
  if (!costsCredit(method)) return null;

  const before = await creditsFor(database, userId, now);
  // Out of credits still records the spend against the allowance rather than
  // silently serving a free import — the balance already reads zero, and a
  // missing row would make the ledger disagree with what actually ran.
  const source = before.nextFrom ?? "allowance";

  await database.insert(schema.creditSpends).values({
    userId,
    month: creditMonth(now),
    source,
    recipeId,
    method,
  });

  return creditsFor(database, userId, now);
}

/** Add bought credits. They never expire, so this only ever goes up. */
export async function grantCredits(
  database: Database,
  userId: string,
  credits: number,
): Promise<CreditBalance> {
  if (credits <= 0) throw new Error("A credit grant has to be positive.");

  await database
    .update(schema.users)
    .set({ creditsPurchased: sql`${schema.users.creditsPurchased} + ${credits}` })
    .where(eq(schema.users.id, userId));

  return creditsFor(database, userId);
}

/** Move someone between plans. Spent credits stay spent. */
export async function setTier(
  database: Database,
  userId: string,
  tier: Tier,
): Promise<CreditBalance> {
  await database.update(schema.users).set({ tier }).where(eq(schema.users.id, userId));
  return creditsFor(database, userId);
}

/** Recent spends, for a "where did my credits go" list. */
export async function recentSpends(
  database: Database,
  userId: string,
  limit = 50,
): Promise<
  { recipeId: string | null; title: string | null; method: ExtractionMethod; source: string; at: Date }[]
> {
  const rows = await database
    .select({
      recipeId: schema.creditSpends.recipeId,
      title: schema.recipes.title,
      method: schema.creditSpends.method,
      source: schema.creditSpends.source,
      at: schema.creditSpends.createdAt,
    })
    .from(schema.creditSpends)
    .leftJoin(schema.recipes, eq(schema.recipes.id, schema.creditSpends.recipeId))
    .where(eq(schema.creditSpends.userId, userId))
    .orderBy(sql`${schema.creditSpends.createdAt} desc`)
    .limit(limit);

  return rows.map((row) => ({
    recipeId: row.recipeId,
    title: row.title,
    method: row.method as ExtractionMethod,
    source: row.source,
    at: row.at,
  }));
}
