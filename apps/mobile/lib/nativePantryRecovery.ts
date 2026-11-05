import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { getClerkInstance } from "@clerk/expo";
import { apiBaseUrl } from "./api";
import { createPantryRecoveryStore } from "./pantryRecovery";

/** Separate per-review pantry consent; encrypted owner/environment namespace. */
export function createNativePantryRecovery(accountId: string, sessionId: string) {
  const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
  return createPantryRecoveryStore({
    accountId, sessionId,
    environment: JSON.stringify([process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "", apiBaseUrl()]),
    currentSession: () => {
      const session = getClerkInstance().session;
      return session ? { accountId: session.user.id, sessionId: session.id } : null;
    },
    digest: text => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text),
    storage: {
      get: key => SecureStore.getItemAsync(key, options),
      set: (key, value) => SecureStore.setItemAsync(key, value, options),
      remove: key => SecureStore.deleteItemAsync(key, options),
    },
  });
}

/** Acquire before a future native account-delete action. Call confirmDeleted only
 * on its confirmed success; cancel on failure/cancellation. This app currently
 * has no native remote-account-delete action. No auth-loss watcher substitutes
 * for confirmation, and no other-device erasure can be promised. */
export function prepareNativePantryAccountDeletion(accountId: string, sessionId: string) {
  return createNativePantryRecovery(accountId, sessionId).prepareAccountDeletion();
}
