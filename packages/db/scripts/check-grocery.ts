import { connectionOptions } from "../src/connection.js";
/**
 * Checks the stored grocery connection against a real database.
 *
 *   pnpm check:grocery
 *
 * Small surface, but the things worth asserting are the ones that would be
 * quietly awful: one connection per person per provider rather than a pile of
 * stale tokens, a chosen store surviving a reconnect, and nobody able to see
 * or clear anybody else's.
 *
 * The Kroger API itself is exercised separately, against a stand-in — see
 * `packages/core/test/carts-kroger.test.ts` and `scripts/kroger-stub.mjs`.
 *
 * Works on its own fixture users and deletes everything it created.
 */
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, inArray } from "drizzle-orm";
import type { KrogerToken } from "@seconds/core";
import * as schema from "../src/schema.js";
import { loadEnvLocal } from "../src/loadEnv.js";
import {
  getConnection,
  removeConnection,
  saveConnection,
  setConnectionStore,
} from "../src/queries/grocery.js";
import { isEncrypted, decryptSecret } from "../src/crypto.js";
import { tokenAad } from "../src/queries/grocery.js";

// GROCERY_TOKEN_ENCRYPTION_KEY (read by crypto.ts, not this file directly)
// needs to actually reach process.env — DATABASE_URL alone isn't enough here.
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

const token = (accessToken: string, minutes = 30): KrogerToken => ({
  accessToken,
  refreshToken: `${accessToken}-refresh`,
  expiresAt: new Date(Date.now() + minutes * 60_000).toISOString(),
});

// --- fixture ----------------------------------------------------------------
const HANDLES = ["gr-shopper", "gr-other"];

async function makeUser(handle: string): Promise<string> {
  const [row] = await db
    .insert(schema.users)
    .values({ email: `${handle}@localhost`, handle, displayName: handle.slice(3) })
    .onConflictDoUpdate({ target: schema.users.email, set: { handle } })
    .returning({ id: schema.users.id });
  return row!.id;
}

const [shopper, other] = (await Promise.all(HANDLES.map(makeUser))) as [string, string];
await db
  .delete(schema.groceryConnections)
  .where(inArray(schema.groceryConnections.userId, [shopper, other]));

// --- connecting -------------------------------------------------------------
expect("nobody starts connected", await getConnection(db, shopper, "kroger"), null);

await saveConnection(db, shopper, "kroger", token("first"));
const connected = (await getConnection(db, shopper, "kroger"))!;

expect("the token is stored", connected.accessToken, "first");
expect("...along with the refresh token", connected.refreshToken, "first-refresh");
expect("...and no store yet", [connected.locationId, connected.locationName], [null, null]);

// The round-trip above hides the encryption, which is the point — so look at the
// raw columns directly and confirm what actually landed on disk is ciphertext,
// not the token anyone with a `SELECT` could lift.
const raw = (await db.query.groceryConnections.findFirst({
  where: eq(schema.groceryConnections.userId, shopper),
}))!;
expect("the access token is encrypted at rest", isEncrypted(raw.accessToken), true);
expect("...and so is the refresh token", isEncrypted(raw.refreshToken!), true);
expect("...and the plaintext isn't sitting in the column", raw.accessToken.includes("first"), false);

// --- reconnecting -----------------------------------------------------------
await setConnectionStore(db, shopper, "kroger", "70100123", "Fred Meyer Interstate");
await saveConnection(db, shopper, "kroger", token("second"));
const reconnected = (await getConnection(db, shopper, "kroger"))!;

expect("a new token replaces the old one", reconnected.accessToken, "second");
expect(
  "...and the store they picked survives it",
  [reconnected.locationId, reconnected.locationName],
  ["70100123", "Fred Meyer Interstate"],
);
expect(
  "there is only ever one row per person per provider",
  (
    await db.query.groceryConnections.findMany({
      where: eq(schema.groceryConnections.userId, shopper),
    })
  ).length,
  1,
);

// --- changing store ---------------------------------------------------------
expect(
  "the store can be changed",
  await setConnectionStore(db, shopper, "kroger", "62000789", "QFC Hollywood"),
  true,
);
expect(
  "...and it stuck",
  (await getConnection(db, shopper, "kroger"))!.locationName,
  "QFC Hollywood",
);
expect(
  "setting a store with nothing connected is a no-op, not an error",
  await setConnectionStore(db, other, "kroger", "70100123", "Fred Meyer Interstate"),
  false,
);

// --- other people -----------------------------------------------------------
expect("connections aren't shared", await getConnection(db, other, "kroger"), null);

await saveConnection(db, other, "kroger", token("theirs"));

// A ciphertext is bound to its own row via AAD — lifting it into someone
// else's row (a botched migration, an admin-tool bug) must not decrypt.
const otherRaw = (await db.query.groceryConnections.findFirst({
  where: eq(schema.groceryConnections.userId, other),
}))!;
let swapDecrypted = false;
try {
  decryptSecret(otherRaw.accessToken, tokenAad(shopper, "kroger", "accessToken"));
  swapDecrypted = true;
} catch {
  // expected: AAD mismatch rejects the swapped ciphertext
}
expect("a ciphertext swapped between rows fails to decrypt", swapDecrypted, false);

await removeConnection(db, other, "kroger");
expect("disconnecting removes it", await getConnection(db, other, "kroger"), null);
expect(
  "...and leaves everyone else alone",
  (await getConnection(db, shopper, "kroger"))!.accessToken,
  "second",
);

// --- cascade ----------------------------------------------------------------
await db.delete(schema.users).where(eq(schema.users.id, shopper));
expect(
  "deleting the account takes the connection with it",
  (
    await db.query.groceryConnections.findMany({
      where: eq(schema.groceryConnections.userId, shopper),
    })
  ).length,
  0,
);

// --- cleanup ----------------------------------------------------------------
await db.delete(schema.users).where(inArray(schema.users.handle, HANDLES));

console.log(failures === 0 ? "\nAll good." : `\n${failures} failed.`);
process.exit(failures === 0 ? 0 : 1);
