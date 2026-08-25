import Constants from "expo-constants";

/**
 * Where the NomNom server lives. On a simulator "localhost" reaches the host
 * machine; on a physical device it does not, so this falls back to the LAN
 * address Expo already knows it is being served from.
 */
export function apiBaseUrl(): string {
  const configured =
    process.env.EXPO_PUBLIC_API_BASE_URL ??
    (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined);
  if (configured && !configured.includes("localhost")) return configured;

  const port = new URL(configured ?? "http://localhost:3000").port || "3000";
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  return host ? `http://${host}:${port}` : (configured ?? "http://localhost:3000");
}
