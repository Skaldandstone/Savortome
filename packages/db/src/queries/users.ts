import { eq } from "drizzle-orm";
import {
  DEFAULT_SHELVES,
  type Allergen,
  type DietaryProfile,
  type DietaryTag,
  type RecipePhoto,
} from "@seconds/core";
import type { Database } from "../client.js";
import * as schema from "../schema.js";
import { friendIdsOf } from "./sharing.js";

export interface ClerkProfile {
  clerkId: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  /**
   * Whether Clerk has proven the person controls this address.
   *
   * This is the only thing standing between "link these two accounts" and
   * "let anyone who types your address inherit your recipes", so it is
   * required rather than optional — a caller that forgets it should fail to
   * compile, not silently link on an unverified claim.
   */
  emailVerified: boolean;
}

/**
 * Raised when an unverified address is already spoken for.
 *
 * Linking on a claimed-but-unproven email would be an account takeover, and
 * creating a second row is impossible because the column is unique, so the
 * only honest outcome is to stop.
 */
export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super("That email address already belongs to an account.");
    this.name = "EmailAlreadyRegisteredError";
  }
}

/** Postgres's unique-violation SQLSTATE. */
const UNIQUE_VIOLATION = "23505";

/**
 * True when `error` is the email index rejecting a duplicate.
 *
 * Drizzle wraps the driver error, so the useful fields can sit on the cause
 * rather than the error itself; both are checked. The constraint name is
 * matched when present because a different unique index failing here would
 * mean something else entirely and must not be swallowed.
 */
function isDuplicateEmail(error: unknown): boolean {
  for (let current = error, depth = 0; current && depth < 4; depth++) {
    const candidate = current as { code?: string; constraint?: string; cause?: unknown };
    if (candidate.code === UNIQUE_VIOLATION && candidate.constraint === "users_email_idx") {
      return true;
    }
    current = candidate.cause;
  }
  return false;
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
 * Map a Clerk identity onto a Savortome user row, creating it on first sight.
 * This is the only place a Clerk id becomes an internal user id.
 *
 * Two unique indexes can reject this write, and they mean different things.
 * A clash on `clerk_id` is the ordinary case — a returning account — and the
 * upsert absorbs it. A clash on `email` means a row already exists for this
 * person under a *different* Clerk id, which is exactly what a Clerk instance
 * migration produces: the development and production instances issue
 * unrelated ids, so every returning user arrives looking brand new while
 * their email is already taken. Left unhandled that is a hard 500 on first
 * sign-in for everyone who had an account before the cutover.
 *
 * So a duplicate email re-binds the existing row to the new Clerk id, but
 * only when Clerk has verified the address. An unverified claim is refused:
 * the whole value of matching on email is that the address proves identity,
 * and an unproven one proves nothing.
 */
export async function upsertUserFromClerk(
  database: Database,
  profile: ClerkProfile,
): Promise<string> {
  let userId: string;
  try {
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
    userId = row!.id;
  } catch (error) {
    if (!isDuplicateEmail(error)) throw error;
    userId = await adoptExistingEmail(database, profile);
  }

  await ensureDefaultShelves(database, userId);
  return userId;
}

/**
 * Re-point the row that already holds this email at the Clerk id now
 * presenting it, and hand back that row's id.
 *
 * The handle is deliberately left alone. It is derived from the Clerk id, so
 * recomputing it here would issue a new one and rot every link the person has
 * already shared — the row is the same account, and it keeps its name.
 */
async function adoptExistingEmail(
  database: Database,
  profile: ClerkProfile,
): Promise<string> {
  if (!profile.emailVerified) throw new EmailAlreadyRegisteredError();

  const [row] = await database
    .update(schema.users)
    .set({
      clerkId: profile.clerkId,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    })
    .where(eq(schema.users.email, profile.email))
    .returning({ id: schema.users.id });

  // The row was there a moment ago. If it is gone now, two sign-ins raced and
  // the other one won; its insert created the account, so try once more.
  if (!row) {
    const existing = await database.query.users.findFirst({
      where: eq(schema.users.email, profile.email),
      columns: { id: true },
    });
    if (!existing) throw new EmailAlreadyRegisteredError();
    return existing.id;
  }
  return row.id;
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

/**
 * Everything the account-deletion webhook needs before it starts: the
 * account's id (to delete it and its recipes) and its Stripe subscription
 * id, if any (to cancel billing *before* the row — and the id — is gone).
 * One lookup instead of two separate ones for what's always the same event.
 */
export async function findUserForDeletion(
  database: Database,
  clerkId: string,
): Promise<{ id: string; stripeSubscriptionId: string | null } | null> {
  const row = await database.query.users.findFirst({
    where: eq(schema.users.clerkId, clerkId),
    columns: { id: true, stripeSubscriptionId: true },
  });
  return row ?? null;
}

/**
 * Deletes the account and hands back every photo every recipe it owned was
 * carrying. The recipes themselves cascade away at the foreign-key level
 * (`recipes.owner_id references users.id on delete cascade`) — fast and
 * simple, but that cascade runs entirely inside Postgres and never touches
 * R2, so without this the account's photo objects would silently outlive
 * the account itself with nothing left that could ever list or delete them.
 *
 * Takes the database id rather than the Clerk id: the caller has already
 * resolved it via `findUserForDeletion` to read the Stripe subscription id,
 * and re-looking the account up by Clerk id here would just repeat that
 * same query for no reason.
 */
export async function deleteUserById(
  database: Database,
  userId: string,
): Promise<{ photos: RecipePhoto[] }> {
  const rows = await database.query.recipes.findMany({
    where: eq(schema.recipes.ownerId, userId),
    columns: { photos: true },
  });

  await database.delete(schema.users).where(eq(schema.users.id, userId));

  return { photos: rows.flatMap((row) => row.photos) };
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
