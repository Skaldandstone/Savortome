import { and, eq } from "drizzle-orm";
import type { KrogerConnection, KrogerToken } from "@seconds/core";
import type { Database } from "../client.js";
import * as schema from "../schema.js";
import { decryptSecret, decryptNullable, encryptSecret, encryptNullable } from "../crypto.js";

/**
 * A shopper's connection to a grocery service.
 *
 * One row per person per provider, so connecting again replaces the tokens
 * rather than accumulating them, and the store they picked survives a
 * reconnect — being made to choose a store again because a token expired would
 * be a strange thing to do to someone.
 */

export type GroceryProvider = "kroger";

export async function getConnection(
  database: Database,
  userId: string,
  provider: GroceryProvider,
): Promise<KrogerConnection | null> {
  const row = await database.query.groceryConnections.findFirst({
    where: and(
      eq(schema.groceryConnections.userId, userId),
      eq(schema.groceryConnections.provider, provider),
    ),
  });
  if (!row) return null;

  // Tokens are stored encrypted; decrypt on the way out so callers never see
  // the ciphertext. Legacy plaintext rows (pre-backfill) pass through unchanged.
  return {
    accessToken: decryptSecret(row.accessToken),
    refreshToken: decryptNullable(row.refreshToken),
    expiresAt: row.expiresAt.toISOString(),
    locationId: row.locationId,
    locationName: row.locationName,
  };
}

/** Store a freshly issued token, leaving any chosen store alone. */
export async function saveConnection(
  database: Database,
  userId: string,
  provider: GroceryProvider,
  token: KrogerToken,
): Promise<void> {
  // Encrypt before the token ever reaches the database. Anyone with read access
  // to this table — or a backup of it — sees ciphertext, not a working token.
  const values = {
    accessToken: encryptSecret(token.accessToken),
    refreshToken: encryptNullable(token.refreshToken),
    expiresAt: new Date(token.expiresAt),
    updatedAt: new Date(),
  };

  await database
    .insert(schema.groceryConnections)
    .values({ userId, provider, ...values })
    .onConflictDoUpdate({
      target: [schema.groceryConnections.userId, schema.groceryConnections.provider],
      set: values,
    });
}

/** Which store this person's cart belongs to. */
export async function setConnectionStore(
  database: Database,
  userId: string,
  provider: GroceryProvider,
  locationId: string,
  locationName: string,
): Promise<boolean> {
  const [updated] = await database
    .update(schema.groceryConnections)
    .set({ locationId, locationName, updatedAt: new Date() })
    .where(
      and(
        eq(schema.groceryConnections.userId, userId),
        eq(schema.groceryConnections.provider, provider),
      ),
    )
    .returning({ userId: schema.groceryConnections.userId });

  return Boolean(updated);
}

/**
 * Kroger's partner OAuth API — the only one documented at
 * https://developer.kroger.com/api-products/api/authorization-endpoints-partner
 * — exposes just `/authorize` and `/token`. No revocation endpoint exists, so
 * disconnecting here can only delete the stored token, not invalidate it on
 * Kroger's side; it's left to expire on its own (`expiresAt`, refreshed only
 * while a connection is live). Re-check that page if Kroger ever adds one.
 */
export async function removeConnection(
  database: Database,
  userId: string,
  provider: GroceryProvider,
): Promise<void> {
  await database
    .delete(schema.groceryConnections)
    .where(
      and(
        eq(schema.groceryConnections.userId, userId),
        eq(schema.groceryConnections.provider, provider),
      ),
    );
}
