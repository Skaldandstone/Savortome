import { connectionOptions } from "../src/connection.js";
/**
 * Checks visibility and saving against a real database.
 *
 *   pnpm check:sharing
 *
 * The point of this one is the negative cases: a private recipe must not be
 * reachable by a stranger holding its id, and a friends-only recipe must not
 * be reachable signed out. Unit tests cover the rule; this covers the query
 * that has to apply it.
 *
 * Works on its own fixture users and deletes everything it created.
 */
import { readFileSync } from "node:fs";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq, inArray } from "drizzle-orm";
import type { Ingredient, Visibility } from "@seconds/core";
import * as schema from "../src/schema.js";
import { getSharedRecipe, saveSharedRecipe, setRecipeVisibility } from "../src/queries/sharing.js";

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
const HANDLES = ["share-owner", "share-friend", "share-stranger"];

async function makeUser(handle: string): Promise<string> {
  const [row] = await db
    .insert(schema.users)
    .values({ email: `${handle}@localhost`, handle, displayName: handle })
    .onConflictDoUpdate({ target: schema.users.email, set: { displayName: handle } })
    .returning({ id: schema.users.id });
  return row!.id;
}

const [ownerId, friendId, strangerId] = await Promise.all(HANDLES.map(makeUser));

// Clean slate so re-runs behave identically.
await db.delete(schema.recipes).where(inArray(schema.recipes.ownerId, [ownerId!, friendId!, strangerId!]));
await db.delete(schema.friendships).where(inArray(schema.friendships.userId, [ownerId!, friendId!]));

// Friendship is stored per direction; the owner's side is what's read here.
await db.insert(schema.friendships).values([
  { userId: ownerId!, friendId: friendId!, status: "accepted" },
  { userId: friendId!, friendId: ownerId!, status: "accepted" },
]);

async function makeRecipe(title: string, visibility: Visibility): Promise<string> {
  const [row] = await db
    .insert(schema.recipes)
    .values({
      ownerId: ownerId!,
      title,
      ingredients: [ing("chicken thigh"), ing("rice")],
      steps: [{ n: 1, text: "Cook it.", timerSeconds: null, sourceTimestamp: null }],
      visibility,
      sourceKind: "manual",
      extractionMethod: "manual",
    })
    .returning({ id: schema.recipes.id });
  return row!.id;
}

const privateId = await makeRecipe("Private one", "private");
const friendsId = await makeRecipe("Friends only", "friends");
const publicId = await makeRecipe("Public one", "public");

const seen = async (recipeId: string, viewerId: string | null) =>
  Boolean(await getSharedRecipe(db, recipeId, viewerId));

// --- the owner sees everything ----------------------------------------------
expect("owner sees their private recipe", await seen(privateId, ownerId!), true);
expect("owner sees their friends-only recipe", await seen(friendsId, ownerId!), true);
expect("owner sees their public recipe", await seen(publicId, ownerId!), true);

// --- private stays private --------------------------------------------------
expect("a friend cannot see a private recipe", await seen(privateId, friendId!), false);
expect("a stranger cannot see a private recipe", await seen(privateId, strangerId!), false);
expect("a signed-out visitor cannot see a private recipe", await seen(privateId, null), false);

// --- friends-only -----------------------------------------------------------
expect("a friend sees a friends-only recipe", await seen(friendsId, friendId!), true);
expect("a stranger cannot see a friends-only recipe", await seen(friendsId, strangerId!), false);
expect(
  "a signed-out link visitor cannot see a friends-only recipe",
  await seen(friendsId, null),
  false,
);

// --- public -----------------------------------------------------------------
expect("a stranger sees a public recipe", await seen(publicId, strangerId!), true);
expect("a signed-out visitor sees a public recipe", await seen(publicId, null), true);

// --- changing visibility ----------------------------------------------------
await setRecipeVisibility(db, ownerId!, privateId, "public");
expect("owner can publish", await seen(privateId, null), true);

const notMine = await setRecipeVisibility(db, strangerId!, publicId, "private");
expect("a stranger cannot change someone else's visibility", notMine, null);
expect("...and the recipe is untouched", await seen(publicId, null), true);

await setRecipeVisibility(db, ownerId!, privateId, "private");
expect("owner can unpublish, and the link stops working", await seen(privateId, null), false);

// --- saving a copy ----------------------------------------------------------
const copyId = await saveSharedRecipe(db, strangerId!, publicId);
const copy = await db.query.recipes.findFirst({ where: eq(schema.recipes.id, copyId) });
expect("the copy belongs to whoever saved it", copy?.ownerId, strangerId!);
expect("the copy records where it came from", copy?.copiedFromId, publicId);
expect("a saved copy starts private", copy?.visibility, "private");
expect("the copy keeps the original's ingredients", copy?.ingredients.length, 2);

const indexed = await db
  .select({ canonicalItem: schema.recipeIngredients.canonicalItem })
  .from(schema.recipeIngredients)
  .where(eq(schema.recipeIngredients.recipeId, copyId));
expect(
  "the copy is indexed for pantry search",
  indexed.map((i) => i.canonicalItem).sort(),
  ["chicken thigh", "rice"],
);

const again = await saveSharedRecipe(db, strangerId!, publicId);
expect("saving twice returns the same copy rather than duplicating", again, copyId);

const asViewer = await getSharedRecipe(db, publicId, strangerId!);
expect("the shared view reports it as already saved", asViewer?.view.alreadySaved, true);
expect("the shared view counts saves", asViewer?.view.saveCount, 1);
expect("the shared view names who shared it", asViewer?.view.sharedBy.handle, "share-owner");

const asOwnerView = await getSharedRecipe(db, publicId, ownerId!);
expect("the owner is not offered a save of their own recipe", asOwnerView?.view.canSave, false);

let refused: string | null = null;
try {
  await saveSharedRecipe(db, ownerId!, publicId);
} catch (err) {
  refused = err instanceof Error ? err.message : "unknown";
}
expect("saving your own recipe is refused", refused !== null, true);

let refusedPrivate: string | null = null;
try {
  await saveSharedRecipe(db, strangerId!, privateId);
} catch (err) {
  refusedPrivate = err instanceof Error ? err.message : "unknown";
}
expect("saving a recipe you cannot see is refused", refusedPrivate !== null, true);

// --- cleanup ----------------------------------------------------------------
await db.delete(schema.recipes).where(inArray(schema.recipes.ownerId, [ownerId!, friendId!, strangerId!]));
await db
  .delete(schema.friendships)
  .where(inArray(schema.friendships.userId, [ownerId!, friendId!]));
await db.delete(schema.users).where(inArray(schema.users.id, [ownerId!, friendId!, strangerId!]));

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
