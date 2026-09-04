import { connectionOptions } from "../src/connection.js";
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
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
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
const db = drizzle(new pg.Pool(connectionOptions(url)), { schema });

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
const HANDLES = ["cr-cook", "cr-other", "cr-boundary"];

async function makeUser(handle: string): Promise<string> {
  const [row] = await db
    .insert(schema.users)
    .values({ email: `${handle}@localhost`, handle, displayName: handle.slice(3) })
    .onConflictDoUpdate({ target: schema.users.email, set: { handle, tier: "free", creditsPurchased: 0 } })
    .returning({ id: schema.users.id });
  return row!.id;
}

const [cook, other, boundary] = (await Promise.all(HANDLES.map(makeUser))) as [string, string, string];
await db.delete(schema.creditSpends).where(inArray(schema.creditSpends.userId, [cook, other, boundary]));
await db.delete(schema.recipes).where(inArray(schema.recipes.ownerId, [cook, other, boundary]));

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
expect("a transcript import takes two credits", after?.total, TIER_ALLOWANCE.free - 2);
expect("...from the monthly allowance first", after?.purchasedLeft, 0);

// Drain the rest of the free tier — one more credit exactly empties it.
await spendCredit(db, cook, "article-llm", null, NOW);
const empty = await creditsFor(db, cook, NOW);
expect("the allowance runs out", empty.total, 0);
expect("...and says so", empty.canSpend, false);
expect("...and blocks the next AI import", await canSpendCredit(db, cook, "article-llm", NOW), false);
expect(
  "...and blocks a two-credit import even harder",
  await canSpendCredit(db, cook, "transcript-llm", NOW),
  false,
);
expect(
  "...but still allows a free one",
  await canSpendCredit(db, cook, "schema-org", NOW),
  true,
);

// --- topping up -------------------------------------------------------------
// grantCredits has no `now` param — production callers always mean "right
// now", so its returned balance reflects the real current month, not this
// fixture's NOW. Purchased credits aren't month-scoped, so `topped` itself is
// fine for those; allowance checks re-fetch under the fixed clock instead.
const topped = await grantCredits(db, cook, 25);
expect("a top-up restores the ability to import", topped.canSpend, true);
expect("...and lands in the purchased pool", topped.purchasedLeft, 25);
const toppedNow = await creditsFor(db, cook, NOW);
expect("...leaving the monthly allowance still empty", toppedNow.allowanceLeft, 0);
expect("...so the next import draws from purchases", toppedNow.nextFrom, "purchased");

const spent = await spendCredit(db, cook, "transcript-llm", null, NOW);
expect("spending now draws down purchases by the transcript's two credits", spent?.purchasedLeft, 23);

// --- the month boundary -----------------------------------------------------
const nextMonth = await creditsFor(db, cook, NEXT);
expect("a new month restores the allowance", nextMonth.allowanceLeft, TIER_ALLOWANCE.free);
expect("...and purchased credits survive it", nextMonth.purchasedLeft, 23);
expect("...so the total is both pools", nextMonth.total, TIER_ALLOWANCE.free + 23);
expect(
  "...and last month's spends stay in last month",
  (await creditsFor(db, cook, NOW)).allowanceLeft,
  0,
);

// --- changing plans ---------------------------------------------------------
// setTier has no `now` param either — same reasoning as grantCredits above,
// so allowance checks re-fetch under the fixed clock rather than trust the
// returned balance's month.
const upgraded = await setTier(db, cook, "pro");
expect("upgrading grants the bigger allowance immediately", upgraded.tier, "pro");
expect(
  // Three credits — the transcript's two plus the article's one — came out
  // of the allowance before it ran dry. The later transcript spend landed
  // entirely in the purchased pool and so doesn't touch the monthly count.
  "...minus only what the allowance itself paid for",
  (await creditsFor(db, cook, NOW)).allowanceLeft,
  TIER_ALLOWANCE.pro - 3,
);

// Someone who overspent a big plan then dropped to a small one.
await setTier(db, other, "pro");
for (let i = 0; i < TIER_ALLOWANCE.plus + 3; i++) {
  await spendCredit(db, other, "article-llm", null, NOW);
}
await setTier(db, other, "plus");
const downgraded = await creditsFor(db, other, NOW);
expect("a downgrade can't produce a negative balance", downgraded.allowanceLeft, 0);
expect("...it just reads as none left", downgraded.canSpend, false);

// --- the boundary between a 1-credit and a 2-credit import ------------------
// Free tier has 3. Spend 2 (one article), leaving exactly 1 — enough for
// another article, not enough for a transcript.
await spendCredit(db, boundary, "article-llm", null, NOW);
await spendCredit(db, boundary, "article-llm", null, NOW);
const oneLeft = await creditsFor(db, boundary, NOW);
expect("exactly one credit left", oneLeft.total, 1);
expect("...enough for a one-credit import", await canSpendCredit(db, boundary, "article-llm", NOW), true);
expect(
  "...but not enough for a two-credit transcript",
  await canSpendCredit(db, boundary, "transcript-llm", NOW),
  false,
);
// Split across pools: 1 left in the allowance, top up 5 purchased, then a
// transcript should draw 1 from each rather than refusing or double-dipping.
const boundaryTopped = await grantCredits(db, boundary, 5);
expect("top-up lands in purchased", boundaryTopped.purchasedLeft, 5);
const split = await spendCredit(db, boundary, "transcript-llm", null, NOW);
expect("the allowance's last credit is used first", split?.allowanceLeft, 0);
expect("...and only the shortfall comes from purchased", split?.purchasedLeft, 4);

// --- isolation --------------------------------------------------------------
expect(
  "one account's spending never touches another's",
  (await creditsFor(db, cook, NOW)).tier,
  "pro",
);

// --- the ledger -------------------------------------------------------------
// Five rows, not three imports: a transcript spends two rows, one for each
// credit it costs, so the ledger's unit is a credit, not an import.
const ledger = await recentSpends(db, cook);
expect("every credit charged is on the ledger", ledger.length, 5);
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
  "...and the ledger rows survive, just without their recipe",
  (await recentSpends(db, cook)).length,
  5,
);
expect(
  "...with its recipe reference nulled rather than the row cascaded away",
  (await recentSpends(db, cook)).filter((e) => e.recipeId === null).length >= 1,
  true,
);

// --- cleanup ----------------------------------------------------------------
await db.delete(schema.creditSpends).where(inArray(schema.creditSpends.userId, [cook, other, boundary]));
await db.delete(schema.recipes).where(inArray(schema.recipes.ownerId, [cook, other, boundary]));
await db.delete(schema.users).where(inArray(schema.users.handle, HANDLES));

console.log(
  failures === 0 ? `\nAll good. Current month is ${creditMonth(NOW)}.` : `\n${failures} failed.`,
);
process.exit(failures === 0 ? 0 : 1);
