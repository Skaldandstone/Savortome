/**
 * Checks async co-op plan suggestions against a real database.
 *
 *   pnpm check:suggestions
 *
 * The point of this one: a suggestion is a proposal, never a write to
 * someone else's calendar. Only accepting one — an action the owner takes —
 * actually plans anything, and it does so through the same copy-then-plan
 * path a shared recipe already uses, so it inherits that path's visibility
 * rules rather than re-deriving them.
 *
 * Works on its own fixture users and deletes everything it created.
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, inArray } from "drizzle-orm";
import type { Ingredient, Visibility } from "@seconds/core";
import * as schema from "../src/schema.js";
import { planForRange } from "../src/queries/plan.js";
import {
  acceptSuggestion,
  dismissSuggestion,
  pendingSuggestions,
  suggestForFriend,
} from "../src/queries/suggestions.js";

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

const ing = (canonicalItem: string): Ingredient => ({
  raw: canonicalItem,
  quantity: 1,
  quantityMax: null,
  unit: null,
  item: canonicalItem,
  canonicalItem,
  notes: null,
  optional: false,
  group: null,
});

// --- fixture ----------------------------------------------------------------
const HANDLES = ["sug-owner", "sug-friend", "sug-stranger"];

async function makeUser(handle: string): Promise<string> {
  const [row] = await db
    .insert(schema.users)
    .values({ email: `${handle}@localhost`, handle, displayName: handle })
    .onConflictDoUpdate({ target: schema.users.email, set: { displayName: handle } })
    .returning({ id: schema.users.id });
  return row!.id;
}

const [ownerId, friendId, strangerId] = await Promise.all(HANDLES.map(makeUser));

await db.delete(schema.recipes).where(inArray(schema.recipes.ownerId, [ownerId!, friendId!, strangerId!]));
await db.delete(schema.friendships).where(inArray(schema.friendships.userId, [ownerId!, friendId!, strangerId!]));
await db.delete(schema.planSuggestions).where(inArray(schema.planSuggestions.ownerId, [ownerId!, friendId!]));

// Only the owner and the friend are mutual friends; the stranger is nobody's.
await db.insert(schema.friendships).values([
  { userId: ownerId!, friendId: friendId!, status: "accepted" },
  { userId: friendId!, friendId: ownerId!, status: "accepted" },
]);

async function makeRecipe(owner: string, title: string, visibility: Visibility): Promise<string> {
  const [row] = await db
    .insert(schema.recipes)
    .values({
      ownerId: owner,
      title,
      ingredients: [ing("black beans")],
      steps: [{ n: 1, text: "Heat it.", timerSeconds: null, sourceTimestamp: null }],
      visibility,
      sourceKind: "manual",
      extractionMethod: "manual",
    })
    .returning({ id: schema.recipes.id });
  return row!.id;
}

const publicDish = await makeRecipe(friendId!, "Friend's Chili", "public");
const privateDish = await makeRecipe(friendId!, "Friend's Secret Sauce", "private");
const strangersDish = await makeRecipe(strangerId!, "Stranger's Soup", "public");

const DATE = "2026-09-10";

// --- who can suggest to whom --------------------------------------------------
console.log("--- suggesting ---");
let refused: string | null = null;
try {
  await suggestForFriend(db, strangerId!, ownerId!, strangersDish, DATE, "dinner");
} catch (err) {
  refused = err instanceof Error ? err.message : "unknown";
}
expect("a non-friend cannot suggest anything to you", refused !== null, true);

let refusedPrivate: string | null = null;
try {
  await suggestForFriend(db, friendId!, ownerId!, privateDish, DATE, "dinner");
} catch (err) {
  refusedPrivate = err instanceof Error ? err.message : "unknown";
}
expect("a friend cannot suggest a dish you wouldn't be able to see", refusedPrivate !== null, true);

await suggestForFriend(db, friendId!, ownerId!, publicDish, DATE, "dinner");
const pending = await pendingSuggestions(db, ownerId!);
expect("the suggestion shows up on the owner's pending pile", pending.length, 1);
expect("...naming who suggested it", pending[0]?.suggestedBy.handle, "sug-friend");
expect("...and what it's for", pending[0]?.title, "Friend's Chili");

expect(
  "the calendar is untouched until the suggestion is accepted",
  (await planForRange(db, ownerId!, DATE, DATE)).length,
  0,
);

// --- dismissing ----------------------------------------------------------------
console.log("\n--- dismissing ---");
const notMineToDismiss = await dismissSuggestion(db, strangerId!, pending[0]!.id);
expect("nobody but the owner can dismiss it", notMineToDismiss, false);

// --- accepting -------------------------------------------------------------------
console.log("\n--- accepting ---");
const accepted = await acceptSuggestion(db, ownerId!, pending[0]!.id);
expect("the owner can accept it", accepted, true);

const planned = await planForRange(db, ownerId!, DATE, DATE);
expect("accepting actually plans it", planned.length, 1);
expect("...with a title that reads correctly", planned[0]?.title, "Friend's Chili");

const plannedRecipe = await db.query.recipes.findFirst({ where: eq(schema.recipes.id, planned[0]!.recipeId) });
expect("the planned recipe is the owner's own copy, not the friend's", plannedRecipe?.ownerId, ownerId!);
expect("...recorded as copied from the original", plannedRecipe?.copiedFromId, publicDish);

expect("the accepted suggestion leaves the pending pile", (await pendingSuggestions(db, ownerId!)).length, 0);

const acceptedAgain = await acceptSuggestion(db, ownerId!, pending[0]!.id);
expect("accepting an already-accepted suggestion is a no-op, not a duplicate plan entry", acceptedAgain, false);

// --- a suggestion whose recipe went private before it was accepted ---------------
console.log("\n--- the recipe going private in the meantime ---");
await suggestForFriend(db, friendId!, ownerId!, publicDish, "2026-09-11", "lunch");
await db.update(schema.recipes).set({ visibility: "private" }).where(eq(schema.recipes.id, publicDish));
const staleSuggestion = (await pendingSuggestions(db, ownerId!))[0]!;
const staleAccept = await acceptSuggestion(db, ownerId!, staleSuggestion.id);
expect("accepting a suggestion whose dish went private fails cleanly", staleAccept, false);
expect(
  "...and clears it from the pending pile rather than offering it forever",
  (await pendingSuggestions(db, ownerId!)).length,
  0,
);

// --- cleanup ------------------------------------------------------------------
await db.delete(schema.recipes).where(inArray(schema.recipes.ownerId, [ownerId!, friendId!, strangerId!]));
await db.delete(schema.planSuggestions).where(inArray(schema.planSuggestions.ownerId, [ownerId!, friendId!]));
await db.delete(schema.friendships).where(inArray(schema.friendships.userId, [ownerId!, friendId!, strangerId!]));
await db.delete(schema.mealPlanEntries).where(inArray(schema.mealPlanEntries.userId, [ownerId!]));
await db.delete(schema.users).where(inArray(schema.users.id, [ownerId!, friendId!, strangerId!]));

console.log(failures === 0 ? "\nAll good." : `\n${failures} failed.`);
process.exit(failures === 0 ? 0 : 1);
