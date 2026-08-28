import { eq } from "drizzle-orm";
import { DEFAULT_SHELVES, type Allergen, type DietaryProfile, type DietaryTag } from "@seconds/core";
import type { Database } from "../client.js";
import * as schema from "../schema.js";
import { friendIdsOf } from "./sharing.js";

export interface ClerkProfile {
  clerkId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
}

/** Handles are user-visible, so keep them short, lowercase, and URL-safe. */
export function handleFromProfile(profile: ClerkProfile): string {
  const base =
    profile.email.split("@")[0]?.toLowerCase().replace(/[^a-z0-9]+/g, "") ||
    profile.displayName.toLowerCase().replace(/[^a-z0-9]+/g, "") ||
    "cook";
  // Suffix with part of the Clerk id so two people named "sam" can coexist.
  return `${base.slice(0, 20)}-${profile.clerkId.slice(-6).toLowerCase()}`;
}

/**
 * Every new account starts with the three built-in shelves. Created idempotently
 * so a webhook retry or a race between two tabs can't double them up.
 */
export async function ensureDefaultShelves(database: Database, userId: string): Promise<void> {
  await database
    .insert(schema.shelves)
    .values(DEFAULT_SHELVES.map(({ type, name }) => ({ userId, type, name })))
    .onConflictDoNothing();
}

/**
 * Map a Clerk identity onto a Second Breakfast user row, creating it on first sight.
 * This is the only place a Clerk id becomes an internal user id.
 */
export async function upsertUserFromClerk(
  database: Database,
  profile: ClerkProfile,
): Promise<string> {
  const [row] = await database
    .insert(schema.users)
    .values({
      clerkId: profile.clerkId,
      email: profile.email,
      handle: handleFromProfile(profile),
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    })
    .onConflictDoUpdate({
      target: schema.users.clerkId,
      // Name, email, and avatar are Clerk's to own; the handle stays put once
      // issued so shared links don't rot.
      set: {
        email: profile.email,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
      },
    })
    .returning({ id: schema.users.id });

  const userId = row!.id;
  await ensureDefaultShelves(database, userId);
  return userId;
}

export async function findUserByClerkId(
  database: Database,
  clerkId: string,
): Promise<string | null> {
  const row = await database.query.users.findFirst({
    where: eq(schema.users.clerkId, clerkId),
    columns: { id: true },
  });
  return row?.id ?? null;
}

export async function deleteUserByClerkId(database: Database, clerkId: string): Promise<void> {
  await database.delete(schema.users).where(eq(schema.users.clerkId, clerkId));
}

/**
 * The local development account used when Clerk keys aren't configured.
 * Never reachable in production — see the guard in the web app's session module.
 */
export async function ensureDevUser(database: Database): Promise<string> {
  const email = "you@localhost";
  const existing = await database.query.users.findFirst({
    where: eq(schema.users.email, email),
    columns: { id: true },
  });
  if (existing) {
    await ensureDefaultShelves(database, existing.id);
    return existing.id;
  }

  const [created] = await database
    .insert(schema.users)
    .values({ email, handle: "you", displayName: "You" })
    .onConflictDoNothing()
    .returning({ id: schema.users.id });

  if (created) {
    await ensureDefaultShelves(database, created.id);
    return created.id;
  }

  // Lost a race with a concurrent request; the row exists now.
  const row = await database.query.users.findFirst({
    where: eq(schema.users.email, email),
    columns: { id: true },
  });
  if (!row) throw new Error("Could not create the development user");
  await ensureDefaultShelves(database, row.id);
  return row.id;
}

/** Someone's own dietary preferences and allergies, for editing them. */
export async function getDietaryProfile(
  database: Database,
  userId: string,
): Promise<DietaryProfile> {
  const row = await database.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { dietaryTags: true, allergens: true },
  });
  return {
    dietaryTags: (row?.dietaryTags ?? []) as DietaryTag[],
    allergens: (row?.allergens ?? []) as Allergen[],
  };
}

export async function setDietaryProfile(
  database: Database,
  userId: string,
  profile: DietaryProfile,
): Promise<void> {
  await database
    .update(schema.users)
    .set({ dietaryTags: profile.dietaryTags, allergens: profile.allergens })
    .where(eq(schema.users.id, userId));
}

/**
 * A friend's allergies — never their preferences, and never a stranger's
 * anything. This exists for exactly one purpose: warning someone suggesting a
 * recipe before they send it, the same trust boundary `suggestForFriend`
 * already requires.
 */
export async function friendAllergens(
  database: Database,
  viewerId: string,
  friendId: string,
): Promise<Allergen[] | null> {
  const friends = await friendIdsOf(database, viewerId);
  if (!friends.has(friendId)) return null;

  const row = await database.query.users.findFirst({
    where: eq(schema.users.id, friendId),
    columns: { allergens: true },
  });
  return (row?.allergens ?? []) as Allergen[];
}
