/**
 * Checks the friendship state machine and the feed against a real database.
 *
 *   pnpm check:friends
 *
 * The interesting cases are the transitions — accepting writes both rows,
 * blocking leaves the blocked person seeing nothing — and the feed only
 * carrying recipes the viewer is actually allowed to see.
 *
 * Works on its own fixture users and deletes everything it created.
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, inArray } from "drizzle-orm";
import type { Ingredient, Visibility } from "@nomnom/core";
import * as schema from "../src/schema.js";
import {
  acceptFriendRequest,
  blockPerson,
  friendsFeed,
  friendsOverview,
  pendingRequestCount,
  relationshipWith,
  removeFriendship,
  sendFriendRequest,
  unblockPerson,
} from "../src/queries/friends.js";
import { getSharedRecipe } from "../src/queries/sharing.js";

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
const throws = async (label: string, fn: () => Promise<unknown>, match?: RegExp) => {
  try {
    await fn();
    failures++;
    console.log(`FAIL  ${label}\n        expected it to be refused`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const ok = !match || match.test(message);
    if (!ok) failures++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n        message was "${message}"`}`);
  }
};

const ing = (canonicalItem: string): Ingredient => ({
  raw: canonicalItem, quantity: 1, quantityMax: null, unit: null,
  item: canonicalItem, canonicalItem, notes: null, optional: false, group: null,
});

// --- fixture ----------------------------------------------------------------
const HANDLES = ["fr-ana", "fr-ben", "fr-cass"];

async function makeUser(handle: string): Promise<string> {
  const [row] = await db
    .insert(schema.users)
    .values({ email: `${handle}@localhost`, handle, displayName: handle.slice(3) })
    .onConflictDoUpdate({ target: schema.users.email, set: { handle } })
    .returning({ id: schema.users.id });
  return row!.id;
}

const [ana, ben, cass] = (await Promise.all(HANDLES.map(makeUser))) as [string, string, string];
const everyone = [ana, ben, cass];

await db.delete(schema.friendships).where(inArray(schema.friendships.userId, everyone));
await db.delete(schema.recipes).where(inArray(schema.recipes.ownerId, everyone));

async function makeRecipe(ownerId: string, title: string, visibility: Visibility) {
  const [row] = await db
    .insert(schema.recipes)
    .values({
      ownerId, title,
      ingredients: [ing("rice")],
      steps: [{ n: 1, text: "Cook.", timerSeconds: null, sourceTimestamp: null }],
      visibility,
      sharedAt: visibility === "private" ? null : new Date(),
      sourceKind: "manual", extractionMethod: "manual",
    })
    .returning({ id: schema.recipes.id });
  return row!.id;
}

// --- requesting -------------------------------------------------------------
expect("strangers start with no relationship", await relationshipWith(db, ana, ben), "none");

const asked = await sendFriendRequest(db, ana, "@FR-BEN");
expect("a request finds the person however the handle was typed", asked.handle, "fr-ben");
expect("the requester sees it as sent", await relationshipWith(db, ana, ben), "request-sent");
expect("the recipient sees it as received", await relationshipWith(db, ben, ana), "request-received");
expect("the recipient gets a badge count", await pendingRequestCount(db, ben), 1);
expect("the requester does not", await pendingRequestCount(db, ana), 0);

await throws("asking twice is refused", () => sendFriendRequest(db, ana, "fr-ben"), /already asked/i);
await throws(
  "asking back is redirected to accepting",
  () => sendFriendRequest(db, ben, "fr-ana"),
  /accept instead/i,
);
await throws("adding yourself is refused", () => sendFriendRequest(db, ana, "fr-ana"), /yourself/i);
await throws("an unknown handle is refused", () => sendFriendRequest(db, ana, "nobody-here"), /handle/i);

// --- accepting --------------------------------------------------------------
await acceptFriendRequest(db, ben, ana);
expect("both sides read as friends", await relationshipWith(db, ana, ben), "friends");
expect("...from either direction", await relationshipWith(db, ben, ana), "friends");
expect("the request no longer waits", await pendingRequestCount(db, ben), 0);

const anaView = await friendsOverview(db, ana);
expect("the friend appears in the list", anaView.friends.map((f) => f.handle), ["fr-ben"]);
expect("with no leftover requests", [anaView.incoming.length, anaView.outgoing.length], [0, 0]);

await throws(
  "accepting a request that was never made is refused",
  () => acceptFriendRequest(db, ana, cass),
  /no request/i,
);

// --- friends-only visibility now works --------------------------------------
const anaFriendsOnly = await makeRecipe(ana, "Ana's friends-only", "friends");
expect("a friend can now see a friends-only recipe", Boolean(await getSharedRecipe(db, anaFriendsOnly, ben)), true);
expect("a non-friend still cannot", Boolean(await getSharedRecipe(db, anaFriendsOnly, cass)), false);

// --- the feed ---------------------------------------------------------------
const anaPublic = await makeRecipe(ana, "Ana's public", "public");
const anaPrivate = await makeRecipe(ana, "Ana's private", "private");

const now = new Date();
await db.insert(schema.ratings).values([
  { userId: ana, recipeId: anaPublic, stars: 4, timesCooked: 2, lastCookedAt: now },
  // Cooking a private recipe must not surface to friends.
  { userId: ana, recipeId: anaPrivate, stars: 5, timesCooked: 1, lastCookedAt: now },
]);

const feed = await friendsFeed(db, ben);
const titles = [...new Set(feed.map((f) => f.recipeTitle))].sort();
expect("the feed carries a friend's shared and public recipes", titles, [
  "Ana's friends-only",
  "Ana's public",
]);
expect("the feed never carries a private recipe", titles.includes("Ana's private"), false);
expect("the feed reports what happened", [...new Set(feed.map((f) => f.kind))].sort(), [
  "cooked",
  "rated",
  "shared",
]);
expect("the feed is newest first", feed.map((f) => f.at).join() === [...feed.map((f) => f.at)].sort().reverse().join(), true);
expect("a stranger's feed is empty", await friendsFeed(db, cass), []);

// --- blocking ---------------------------------------------------------------
await blockPerson(db, ana, ben);
expect("the blocker sees the block", await relationshipWith(db, ana, ben), "blocked");
expect("the blocked person sees nothing at all", await relationshipWith(db, ben, ana), "none");
expect("blocking ends the friendship", (await friendsOverview(db, ana)).friends.length, 0);
expect(
  "a blocked person loses access to friends-only recipes",
  Boolean(await getSharedRecipe(db, anaFriendsOnly, ben)),
  false,
);
await throws("the blocker cannot re-add them", () => sendFriendRequest(db, ana, "fr-ben"), /blocked/i);

await unblockPerson(db, ana, ben);
expect("unblocking clears it", await relationshipWith(db, ana, ben), "none");

// --- removing ---------------------------------------------------------------
await sendFriendRequest(db, ana, "fr-ben");
await acceptFriendRequest(db, ben, ana);
expect("they're friends again", await relationshipWith(db, ana, ben), "friends");

await removeFriendship(db, ben, ana);
expect("either side can end it", await relationshipWith(db, ana, ben), "none");
expect("...and it's gone from both lists", (await friendsOverview(db, ben)).friends.length, 0);

// --- cleanup ----------------------------------------------------------------
await db.delete(schema.recipes).where(inArray(schema.recipes.ownerId, everyone));
await db.delete(schema.friendships).where(inArray(schema.friendships.userId, everyone));
await db.delete(schema.users).where(inArray(schema.users.id, everyone));

console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
