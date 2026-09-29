import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ClerkProvider } from "@clerk/expo";
import { ThemeProvider } from "@/ui";
import { useReducedMotion } from '@/ui/ThemeProvider';
import { createClerkTokenCache } from "@/lib/clerkTokenCache";

const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;
const tokenCache = publishableKey ? createClerkTokenCache(publishableKey) : undefined;

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
        {publishableKey ? <ClerkProvider
          publishableKey={publishableKey}
          tokenCache={tokenCache}
          // The native sync layer also retains a device token across an instance
          // change. Use the supported JS cache until Clerk exposes a native cache
          // namespace/migration hook; hosted auth itself remains unchanged.
          __experimental_disableNativeClientSync
        >{navigator}</ClerkProvider> : navigator}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function AppNavigator() {
  const reducedMotion = useReducedMotion();
  return <Stack screenOptions={{ headerShown:false, animation:reducedMotion ? 'none' : 'default' }}><Stack.Screen name="(protected)" /><Stack.Screen name="care" /></Stack>;
}
