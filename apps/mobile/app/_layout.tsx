import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { AuthGate } from "@/modules/account";
import { ThemeProvider } from "@/ui";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StatusBar style="auto" />
        {/* The session token is kept in expo-secure-store, not in memory, so it
            survives a restart the way people expect a signed-in app to. */}
        <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
          <AuthGate>
            <Stack screenOptions={{ headerShown: false }} />
          </AuthGate>
        </ClerkProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
