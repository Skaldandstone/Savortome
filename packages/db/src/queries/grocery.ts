import { and, eq } from "drizzle-orm";
import { decryptSecret, encryptSecret, type KrogerConnection, type KrogerToken } from "@seconds/core";
import type { Database } from "../client.js";
import * as schema from "../schema.js";

/**
 * A shopper's connection to a grocery service.
 *
 * One row per person per provider, so connecting again replaces the tokens
 * rather than accumulating them, and the store they picked survives a
 * reconnect — being made to choose a store again because a token expired would
 * be a strange thing to do to someone.
 *
 * The access and refresh tokens are live bearer credentials for the shopper's
 * real Kroger account, so they are encrypted on the way in and decrypted on the
 * way out (see secret-box in @seconds/core). The row's identity is bound into
 * each token's authentication tag, so a ciphertext can't be moved between rows.
 */

export type GroceryProvider = "kroger";

/** Ties a stored token's ciphertext to the row and field it belongs to. */
function tokenAad(userId: string, provider: GroceryProvider, field: "access" | "refresh"): string {
  return `grocery:${provider}:${userId}:${field}`;
}

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

  return {
    accessToken: decryptSecret(row.accessToken, tokenAad(userId, provider, "access")),
    refreshToken:
      row.refreshToken === null
        ? null
        : decryptSecret(row.refreshToken, tokenAad(userId, provider, "refresh")),
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
  const values = {
    accessToken: encryptSecret(token.accessToken, tokenAad(userId, provider, "access")),
    refreshToken:
      token.refreshToken === null
        ? null
        : encryptSecret(token.refreshToken, tokenAad(userId, provider, "refresh")),
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
