import * as SecureStore from "expo-secure-store";

type TokenCache = {
  getToken: (key: string) => Promise<string | null>;
  saveToken: (key: string, token: string) => Promise<void>;
  clearToken: (key: string) => Promise<void>;
};

/**
 * Clerk's default Expo cache uses one fixed key. That is fine until a beta app
 * changes Clerk instances: a token from the old instance is then offered to
 * the new one before React can render, leaving the provider stuck loading.
 * Namespace the cache by public frontend key so environment changes start
 * signed out and can never replay a token across Clerk instances.
 */
export function createClerkTokenCache(publishableKey: string): TokenCache {
  const namespace = publishableKey.slice(-16).replace(/[^A-Za-z0-9._-]/g, "_");
  const options = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };
  const scoped = (key: string) => `savortome_${namespace}_${key.replace(/[^A-Za-z0-9._-]/g, "_")}`;

  return {
    async getToken(key) {
      try {
        return await SecureStore.getItemAsync(scoped(key), options);
      } catch {
        await SecureStore.deleteItemAsync(scoped(key), options);
        return null;
      }
    },
    saveToken(key, token) {
      return SecureStore.setItemAsync(scoped(key), token, options);
    },
    clearToken(key) {
      return SecureStore.deleteItemAsync(scoped(key), options);
    },
  };
}
