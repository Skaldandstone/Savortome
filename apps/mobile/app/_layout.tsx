import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ClerkProvider } from "@clerk/expo";
import { tokenCache } from "@clerk/expo/token-cache";
import { ThemeProvider } from "@/ui";
import { useReducedMotion } from '@/ui/ThemeProvider';

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

/**
 * Providers and the navigator. Only the protected routes require sign-in. The tabs are one entry
 * in the stack so that recipes and the importer push over them.
 */
export default function RootLayout() {
  const navigator = <AppNavigator />;
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StatusBar style="auto" />
        {/* The session token lives in expo-secure-store, so it survives a
            restart the way people expect a signed-in app to. */}
        {publishableKey ? <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>{navigator}</ClerkProvider> : navigator}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function AppNavigator() {
  const reducedMotion = useReducedMotion();
  return <Stack screenOptions={{ headerShown:false, animation:reducedMotion ? 'none' : 'default' }}><Stack.Screen name="(protected)" /><Stack.Screen name="care" /></Stack>;
}
