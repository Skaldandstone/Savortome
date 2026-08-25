import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { AuthGate } from "@/modules/account";
import { ThemeProvider } from "@/ui";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

/**
 * Providers, then the sign-in gate, then the navigator. The tabs are one entry
 * in the stack so that recipes and the importer push over them.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StatusBar style="auto" />
        {/* The session token lives in expo-secure-store, so it survives a
            restart the way people expect a signed-in app to. */}
        <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
          <AuthGate>
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="(tabs)" />
            </Stack>
          </AuthGate>
        </ClerkProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
