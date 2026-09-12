import { connectionOptions } from "../src/connection.js";
/**
 * Checks account provisioning against a real database.
 *
 *   pnpm check:users
 *
 * `upsertUserFromClerk` runs on literally every signed-in request, so when it
 * throws, every page throws. It did: moving Clerk from the development
 * instance to the production one reissued everybody's Clerk id, so returning
 * users arrived looking brand new while their email was already taken, the
 * `on conflict (clerk_id)` never matched, and the insert died against
 * `users_email_idx`. `/profile` and `/plan` 500'd for the owner in
 * production, and nothing in the suite noticed, because nothing in the suite
 * had ever provisioned a user twice under two different Clerk ids.
 *
 * That is the case this exists to hold down, along with the rule that keeps it
 * safe: an existing account is adopted only when Clerk has *verified* the
 * address. Without that check this function would hand any account to anyone
 * who typed the right email at sign-up.
 *
 * Works on its own fixture users and deletes everything it created.
 */
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray, like } from "drizzle-orm";
import * as schema from "../src/schema.js";
import { loadEnvLocal } from "../src/loadEnv.js";
import {
  EmailAlreadyRegisteredError,
  handleFromProfile,
  upsertUserFromClerk,
} from "../src/queries/users.js";

loadEnvLocal();

const url = process.env.DATABASE_URL!;
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

const EMAIL = "cutover-check@users.savortome.local";
const OTHER_EMAIL = "cutover-other@users.savortome.local";
const DEV_CLERK_ID = "user_checkusers_dev";
const PROD_CLERK_ID = "user_checkusers_prod";

const profile = (over: Partial<Parameters<typeof upsertUserFromClerk>[1]> = {}) => ({
  clerkId: DEV_CLERK_ID,
  email: EMAIL,
  displayName: "Cutover Check",
  avatarUrl: null,
  emailVerified: true,
  ...over,
});

// --- clean slate ------------------------------------------------------------
const wipe = () =>
  db.delete(schema.users).where(inArray(schema.users.email, [EMAIL, OTHER_EMAIL]));
await wipe();

// --- first sight ------------------------------------------------------------
const firstId = await upsertUserFromClerk(db, profile());
const created = (await db.query.users.findFirst({ where: eq(schema.users.id, firstId) }))!;

expect("a new Clerk identity creates an account", Boolean(firstId), true);
expect("...owned by that Clerk id", created.clerkId, DEV_CLERK_ID);
expect("...with the handle derived from the id", created.handle, handleFromProfile(profile()));

const shelves = await db.query.shelves.findMany({
  where: eq(schema.shelves.userId, firstId),
});
expect("...and the three built-in shelves", shelves.length, 3);

// --- signing in again -------------------------------------------------------
const againId = await upsertUserFromClerk(db, profile({ displayName: "Renamed In Clerk" }));
expect("signing in again reuses the same account", againId, firstId);
expect(
  "...and takes the new display name from Clerk",
  (await db.query.users.findFirst({ where: eq(schema.users.id, firstId) }))!.displayName,
  "Renamed In Clerk",
);
expect(
  "...without piling up shelves",
  (await db.query.shelves.findMany({ where: eq(schema.shelves.userId, firstId) })).length,
  3,
);

// --- the Clerk instance cutover ---------------------------------------------
// The production instance issues an id this row has never seen, for a person
// it already knows by email. This is the exact shape that broke production.
const migratedId = await upsertUserFromClerk(
  db,
  profile({ clerkId: PROD_CLERK_ID, displayName: "Cutover Check" }),
);
const migrated = (await db.query.users.findFirst({ where: eq(schema.users.id, firstId) }))!;

expect("a reissued Clerk id keeps the same account", migratedId, firstId);
expect("...re-bound to the new Clerk id", migrated.clerkId, PROD_CLERK_ID);
expect(
  "...keeping the original handle so shared links don't rot",
  migrated.handle,
  handleFromProfile(profile()),
);
expect(
  "...and creating no second row for the address",
  (await db.query.users.findMany({ where: eq(schema.users.email, EMAIL) })).length,
  1,
);

// --- and back again ---------------------------------------------------------
expect(
  "the re-bound id is now the one that matches",
  await upsertUserFromClerk(db, profile({ clerkId: PROD_CLERK_ID })),
  firstId,
);

// --- unverified email is refused --------------------------------------------
// Same address, a third Clerk id, no proof it belongs to them. Adopting here
// would hand this account to a stranger.
let refused = false;
try {
  await upsertUserFromClerk(
    db,
    profile({ clerkId: "user_checkusers_impostor", emailVerified: false }),
  );
} catch (error) {
  refused = error instanceof EmailAlreadyRegisteredError;
}
expect("an unverified claim on a taken address is refused", refused, true);
expect(
  "...and the account still belongs to the verified id",
  (await db.query.users.findFirst({ where: eq(schema.users.id, firstId) }))!.clerkId,
  PROD_CLERK_ID,
);

// --- unrelated accounts are untouched ---------------------------------------
const otherId = await upsertUserFromClerk(
  db,
  profile({ clerkId: "user_checkusers_other", email: OTHER_EMAIL, displayName: "Someone Else" }),
);
expect("a different address is a different account", otherId === firstId, false);

// --- cleanup ----------------------------------------------------------------
await wipe();
await db.delete(schema.users).where(like(schema.users.email, "%@users.savortome.local"));

console.log(failures === 0 ? "\nAll good." : `\n${failures} failed.`);
process.exit(failures === 0 ? 0 : 1);
