import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { getClerkInstance } from "@clerk/expo";
import { apiBaseUrl } from "./api";
import { createFoodNoteRecoveryStore } from "./foodNoteRecovery";

/** Today calls this only through explicit device recovery controls. */
export function createNativeFoodNoteRecovery(accountId: string, sessionId: string) {
  const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
  return createFoodNoteRecoveryStore({
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
