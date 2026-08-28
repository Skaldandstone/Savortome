/**
 * Checks the dietary profile — reading and writing your own, and reading a
 * friend's allergens for a suggestion warning — against a real database.
 *
 *   pnpm check:dietary
 *
 * The point of this one: a friend's allergens are the one piece of another
 * account's private data this app ever reads, and only for an actual friend.
 * Unit tests in `packages/core` cover the keyword matching itself
 * (`dietary.test.ts`); this covers the query layer's access control around it.
 *
 * Works on its own fixture users and deletes everything it created.
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { inArray } from "drizzle-orm";
import * as schema from "../src/schema.js";
import {
  friendAllergens,
  getDietaryProfile,
  setDietaryProfile,
} from "../src/queries/users.js";

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
const HANDLES = ["diet-owner", "diet-friend", "diet-stranger"];

async function makeUser(handle: string): Promise<string> {
  const [row] = await db
    .insert(schema.users)
    .values({ email: `${handle}@localhost`, handle, displayName: handle })
    .onConflictDoUpdate({ target: schema.users.email, set: { displayName: handle } })
    .returning({ id: schema.users.id });
  return row!.id;
}

const [ownerId, friendId, strangerId] = await Promise.all(HANDLES.map(makeUser));

await db.delete(schema.friendships).where(inArray(schema.friendships.userId, [ownerId!, friendId!]));
await setDietaryProfile(db, ownerId!, { dietaryTags: [], allergens: [] });
await setDietaryProfile(db, friendId!, { dietaryTags: [], allergens: [] });

// --- reading and writing your own profile ---------------------------------------
console.log("--- your own profile ---");
const blank = await getDietaryProfile(db, ownerId!);
expect("a fresh account starts with no preferences or allergies", blank, { dietaryTags: [], allergens: [] });

await setDietaryProfile(db, ownerId!, { dietaryTags: ["vegetarian", "gluten-free"], allergens: ["peanuts"] });
const saved = await getDietaryProfile(db, ownerId!);
expect("preferences round-trip", saved.dietaryTags.sort(), ["gluten-free", "vegetarian"]);
expect("allergies round-trip", saved.allergens, ["peanuts"]);

// --- a friend's allergens, and only a friend's --------------------------------
console.log("\n--- a friend's allergens ---");
await setDietaryProfile(db, friendId!, { dietaryTags: [], allergens: ["shellfish", "tree-nuts"] });

const notYetFriends = await friendAllergens(db, ownerId!, friendId!);
expect("a non-friend's allergens are not readable", notYetFriends, null);

await db.insert(schema.friendships).values([
  { userId: ownerId!, friendId: friendId!, status: "accepted" },
  { userId: friendId!, friendId: ownerId!, status: "accepted" },
]);

const asFriend = await friendAllergens(db, ownerId!, friendId!);
expect("a friend's allergens are readable once you actually are friends", asFriend?.sort(), [
  "shellfish",
  "tree-nuts",
]);

const strangerTrying = await friendAllergens(db, strangerId!, friendId!);
expect("a stranger still can't read them, even though someone else can", strangerTrying, null);

const askingAboutSelf = await friendAllergens(db, ownerId!, strangerId!);
expect("asking about someone who isn't your friend at all also answers null", askingAboutSelf, null);

// --- cleanup ------------------------------------------------------------------
await setDietaryProfile(db, ownerId!, { dietaryTags: [], allergens: [] });
await setDietaryProfile(db, friendId!, { dietaryTags: [], allergens: [] });
await db.delete(schema.friendships).where(inArray(schema.friendships.userId, [ownerId!, friendId!]));
await db.delete(schema.users).where(inArray(schema.users.id, [ownerId!, friendId!, strangerId!]));

console.log(failures === 0 ? "\nAll good." : `\n${failures} failed.`);
process.exit(failures === 0 ? 0 : 1);
