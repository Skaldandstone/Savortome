import "server-only";
import {
  KrogerError,
  krogerCredentials,
  needsRefresh,
  productToken,
  refreshToken,
  type KrogerConnection,
  type KrogerCredentials,
} from "@nomnom/core";
import { getConnection, saveConnection, type Database } from "@nomnom/db";

/**
 * The bits of the Kroger flow that both the cart route and the connection
 * routes need, in one place so neither has to know how a token is kept fresh.
 */

/** The cookie the OAuth `state` is parked in between leaving and coming back. */
export const KROGER_STATE_COOKIE = "nomnom_kroger_state";

/**
 * Where to send Kroger's non-OAuth calls.
 *
 * Everything else reads it off the credentials; store and product lookups take
 * it per call, so this is the one place that has to say it out loud.
 */
export const krogerApi = (): { baseUrl?: string } =>
  process.env.KROGER_API_BASE ? { baseUrl: process.env.KROGER_API_BASE } : {};

export function requireKrogerCredentials(): KrogerCredentials {
  const credentials = krogerCredentials(process.env);
  if (!credentials) {
    throw new KrogerError(
      "Kroger isn't configured. Set KROGER_CLIENT_ID, KROGER_CLIENT_SECRET, and KROGER_REDIRECT_URI.",
    );
  }
  return credentials;
}

/**
 * The shopper's connection, with a live token.
 *
 * Kroger's customer tokens last half an hour, which is easily shorter than the
 * gap between building a list and sending it, so this refreshes on the way past
 * rather than letting the cart request be the thing that discovers the problem.
 */
export async function liveConnection(
  database: Database,
  userId: string,
): Promise<KrogerConnection> {
  const stored = await getConnection(database, userId, "kroger");
  if (!stored) {
    throw new KrogerError("Connect your Kroger account first.", 401);
  }
  if (!needsRefresh(stored.expiresAt)) return stored;

  if (!stored.refreshToken) {
    throw new KrogerError("That Kroger connection has expired. Connect it again.", 401);
  }

  const fresh = await refreshToken(requireKrogerCredentials(), stored.refreshToken);
  await saveConnection(database, userId, "kroger", fresh);
  return { ...stored, ...fresh };
}

/**
 * A token for searching the catalogue.
 *
 * Deliberately not the shopper's token: product search is
 * `client_credentials`, belongs to the application rather than to anyone, and
 * asking for it separately keeps a customer token from being spent on reads.
 */
export async function catalogueToken(): Promise<string> {
  const token = await productToken(requireKrogerCredentials());
  return token.accessToken;
}
