import type { ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Link } from 'expo-router';
import { ClerkLoaded, ClerkLoading, Show } from "@clerk/expo";
import { usePalette } from "@/ui";
import { SignInScreen } from "./SignInScreen";

/**
 * Decides between the sign-in screen and the app. Clerk restores the session
 * from secure storage on launch, so this waits for that rather than flashing
 * the sign-in screen at someone who is already signed in.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const c = usePalette();
  if (!process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY) return <View style={{ padding:24, backgroundColor:c.bg }}><Text style={{color:c.text}}>Account features need the beta account configuration. Feed me gently works without an account.</Text><Link href="/care" style={{color:c.accent,paddingVertical:20}}>Open Feed me gently</Link></View>;

  return (
    <>
      <ClerkLoading>
        <View style={[styles.loading, { backgroundColor: c.bg }]}>
          <ActivityIndicator color={c.accent} />
        </View>
      </ClerkLoading>
      <ClerkLoaded>
        <Show when="signed-out">
          <SignInScreen />
        </Show>
        <Show when="signed-in">{children}</Show>
      </ClerkLoaded>
    </>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
});
