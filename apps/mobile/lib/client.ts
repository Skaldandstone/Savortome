import { createClient } from "@seconds/core/format";
import { getClerkInstance } from "@clerk/expo";
import { apiBaseUrl } from "./api";
import { getAccountToken } from './accountToken';

/**
 * Network client for the Second Breakfast server. Unlike the web app there is no cookie
 * to ride on, so every request carries a Clerk session token.
 *
 * The token is read from Clerk's singleton rather than a hook, so non-component
 * code can use this client too.
 */
export const api = createClient({
  baseUrl: apiBaseUrl(),
  getToken: async () => {
    try {
      return (await getClerkInstance().session?.getToken()) ?? null;
    } catch {
      // No Clerk keys configured, or not signed in yet. The server decides.
      return null;
    }
  },
});

/** Sensitive writes cannot acquire another account's token during an account switch. */
export function createAccountClient(accountId: string) {
  return createClient({ baseUrl: apiBaseUrl(), getToken: () => getAccountToken(accountId, () => getClerkInstance().session) });
}
