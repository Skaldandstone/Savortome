/**
 * Checks AI credit metering against a real database.
 *
 *   pnpm check:credits
 *
 * The things worth asserting: free imports never take a credit, the monthly
 * allowance is spent before purchased credits, the month boundary resets the
 * allowance but not the purchases, a downgrade can't produce a negative
 * balance, and deleting a recipe doesn't refund a model call that already ran.
 *
 * Works on its own fixture users and deletes everything it created.
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, inArray } from "drizzle-orm";
import { TIER_ALLOWANCE, creditMonth } from "@seconds/core";
import * as schema from "../src/schema.js";
import {
  canSpendCredit,
  creditsFor,
  grantCredits,
  recentSpends,
  setTier,
  spendCredit,
} from "../src/queries/credits.js";

const url =
  process.env.DATABASE_URL ??
  /DATABASE_URL=(.+)/.exec(readFileSync("../../apps/web/.env.local", "utf8"))![1]!.trim();
const db = drizzle(neon(url), { schema });

let failures = 0;
const expect = (label: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}` +
      (ok ? "" : `\n        got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`),
  );
};

// --- fixture ----------------------------------------------------------------
const HANDLES = ["cr-cook", "cr-other"];

async function makeUser(handle: string): Promise<string> {
  const [row] = await db
    .insert(schema.users)
    .values({ email: `${handle}@localhost`, handle, displayName: handle.slice(3) })
    .onConflictDoUpdate({ target: schema.users.email, set: { handle, tier: "free", creditsPurchased: 0 } })
    .returning({ id: schema.users.id });
  return row!.id;
}

const [cook, other] = (await Promise.all(HANDLES.map(makeUser))) as [string, string];
await db.delete(schema.creditSpends).where(inArray(schema.creditSpends.userId, [cook, other]));
await db.delete(schema.recipes).where(inArray(schema.recipes.ownerId, [cook, other]));

async function makeRecipe(ownerId: string, title: string): Promise<string> {
  const [row] = await db
    .insert(schema.recipes)
    .values({
      ownerId, title, ingredients: [], steps: [],
      sourceKind: "manual", extractionMethod: "manual",
    })
    .returning({ id: schema.recipes.id });
  return row!.id;
}

const NOW = new Date("2026-08-26T12:00:00Z");
const NEXT = new Date("2026-09-02T12:00:00Z");

// --- a fresh account --------------------------------------------------------
const fresh = await creditsFor(db, cook, NOW);
expect("a new account starts on the free tier", fresh.tier, "free");
expect("...with the whole free allowance", fresh.total, TIER_ALLOWANCE.free);

// --- free extractions never charge ------------------------------------------
expect("schema.org costs nothing", await spendCredit(db, cook, "schema-org", null, NOW), null);
expect("a hand-typed recipe costs nothing", await spendCredit(db, cook, "manual", null, NOW), null);
expect(
  "...and neither wrote a ledger row",
  (await creditsFor(db, cook, NOW)).total,
  TIER_ALLOWANCE.free,
);
expect(
  "a free method is always allowed, even at zero",
  await canSpendCredit(db, cook, "schema-org", NOW),
  true,
);

// --- spending ---------------------------------------------------------------
const r1 = await makeRecipe(cook, "From a video");
const after = await spendCredit(db, cook, "transcript-llm", r1, NOW);
expect("an AI import takes one credit", after?.total, TIER_ALLOWANCE.free - 1);
expect("...from the monthly allowance first", after?.purchasedLeft, 0);

// Drain the free tier.
await spendCredit(db, cook, "article-llm", null, NOW);
await spendCredit(db, cook, "caption-llm", null, NOW);
const empty = await creditsFor(db, cook, NOW);
expect("the allowance runs out", empty.total, 0);
expect("...and says so", empty.canSpend, false);
expect("...and blocks the next AI import", await canSpendCredit(db, cook, "article-llm", NOW), false);
expect(
  "...but still allows a free one",
  await canSpendCredit(db, cook, "schema-org", NOW),
  true,
);

// --- topping up -------------------------------------------------------------
const topped = await grantCredits(db, cook, 25);
expect("a top-up restores the ability to import", topped.canSpend, true);
expect("...and lands in the purchased pool", topped.purchasedLeft, 25);
expect("...leaving the monthly allowance still empty", topped.allowanceLeft, 0);
expect("...so the next import draws from purchases", topped.nextFrom, "purchased");

const spent = await spendCredit(db, cook, "transcript-llm", null, NOW);
expect("spending now draws down purchases", spent?.purchasedLeft, 24);

// --- the month boundary -----------------------------------------------------
const nextMonth = await creditsFor(db, cook, NEXT);
expect("a new month restores the allowance", nextMonth.allowanceLeft, TIER_ALLOWANCE.free);
expect("...and purchased credits survive it", nextMonth.purchasedLeft, 24);
expect("...so the total is both pools", nextMonth.total, TIER_ALLOWANCE.free + 24);
expect(
  "...and last month's spends stay in last month",
  (await creditsFor(db, cook, NOW)).allowanceLeft,
  0,
);

// --- changing plans ---------------------------------------------------------
const upgraded = await setTier(db, cook, "pro");
expect("upgrading grants the bigger allowance immediately", upgraded.tier, "pro");
expect(
  // Three of the four spends came out of the allowance; the fourth was a
  // purchased credit and so doesn't touch the monthly count.
  "...minus only what the allowance itself paid for",
  upgraded.allowanceLeft,
  TIER_ALLOWANCE.pro - 3,
);

// Someone who overspent a big plan then dropped to a small one.
await setTier(db, other, "pro");
for (let i = 0; i < TIER_ALLOWANCE.plus + 3; i++) {
  await spendCredit(db, other, "article-llm", null, NOW);
}
const downgraded = await setTier(db, other, "plus");
expect("a downgrade can't produce a negative balance", downgraded.allowanceLeft, 0);
expect("...it just reads as none left", downgraded.canSpend, false);

// --- isolation --------------------------------------------------------------
expect(
  "one account's spending never touches another's",
  (await creditsFor(db, cook, NOW)).tier,
  "pro",
);

// --- the ledger -------------------------------------------------------------
const ledger = await recentSpends(db, cook);
expect("every charged import is on the ledger", ledger.length, 4);
expect("...naming the recipe it paid for", ledger.some((e) => e.title === "From a video"), true);
expect(
  "...and no free extraction is",
  ledger.every((e) => e.method !== "schema-org" && e.method !== "manual"),
  true,
);

// --- deleting a recipe ------------------------------------------------------
await db.delete(schema.recipes).where(eq(schema.recipes.id, r1));
const afterDelete = await creditsFor(db, cook, NOW);
expect(
  "deleting a recipe does not refund the model call",
  afterDelete.allowanceUsed,
  3,
);
expect(
  "...and the ledger row survives, just without its recipe",
  (await recentSpends(db, cook)).length,
  4,
);
expect(
  "...with its recipe reference nulled rather than the row cascaded away",
  (await recentSpends(db, cook)).filter((e) => e.recipeId === null).length >= 1,
  true,
);

// --- cleanup ----------------------------------------------------------------
await db.delete(schema.creditSpends).where(inArray(schema.creditSpends.userId, [cook, other]));
await db.delete(schema.recipes).where(inArray(schema.recipes.ownerId, [cook, other]));
await db.delete(schema.users).where(inArray(schema.users.handle, HANDLES));

console.log(
  failures === 0 ? `\nAll good. Current month is ${creditMonth(NOW)}.` : `\n${failures} failed.`,
);
process.exit(failures === 0 ? 0 : 1);
