import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db, ensureDevUser, upsertUserFromClerk, type Database } from "@seconds/db";

/**
 * The single seam between "who is making this request" and the rest of the app.
 * Nothing else reaches for a Clerk id or a user row directly.
 *
 * Two modes:
 *  - Clerk configured: the real thing, for web cookies and mobile bearer tokens alike.
 *  - Clerk not configured: a single local development account, so the app is
 *    runnable straight after `pnpm install`. Refused outside development.
 */

export const databaseConfigured = (): boolean => Boolean(process.env.DATABASE_URL);

export const clerkConfigured = (): boolean =>
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

/** True when requests fall back to the shared local account instead of real auth. */
export const usingDevAccount = (): boolean =>
  !clerkConfigured() && process.env.NODE_ENV !== "production";

export class NotSignedInError extends Error {
  constructor(message = "Sign in to do that.") {
    super(message);
    this.name = "NotSignedInError";
  }
}

export class NotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotConfiguredError";
  }
}

/**
 * The internal user id for this request, or null when nobody is signed in.
 * Creates the user row (and their default shelves) on first sight.
 */
export async function currentUserId(database: Database = db()): Promise<string | null> {
  if (usingDevAccount()) return ensureDevUser(database);

  if (!clerkConfigured()) {
    throw new NotConfiguredError(
      "Clerk is not configured. Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY.",
    );
  }

  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  const user = await currentUser();
  const address = user?.primaryEmailAddress ?? user?.emailAddresses[0] ?? null;
  const email =
    address?.emailAddress ??
    // Phone-only and OAuth-only accounts can have no email; the column is
    // required, so synthesize a stable stand-in rather than failing sign-in.
    `${clerkId}@users.savortome.local`;

  return upsertUserFromClerk(database, {
    clerkId,
    email,
    // Whether Clerk actually proved this address belongs to them. It decides
    // whether an existing account with the same email may be adopted, so a
    // missing address reads as unverified rather than as trustworthy: the
    // synthesized stand-in above is unique per Clerk id and can never collide
    // with a real one anyway.
    emailVerified: address?.verification?.status === "verified",
    displayName:
      user?.fullName ?? user?.username ?? email.split("@")[0] ?? "Cook",
    avatarUrl: user?.imageUrl ?? null,
  });
}

/** Same, but for routes that have no meaning signed out. */
export async function requireUserId(database: Database = db()): Promise<string> {
  const id = await currentUserId(database);
  if (!id) throw new NotSignedInError();
  return id;
}

/**
 * The viewer's id, or null — never throws.
 *
 * Public pages are reachable by strangers and by crawlers, so an unconfigured
 * Clerk or a missing session has to read as "signed out", not as an error page.
 */
export async function viewerId(database: Database = db()): Promise<string | null> {
  try {
    return await currentUserId(database);
  } catch {
    return null;
  }
}
