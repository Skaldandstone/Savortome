import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Link } from 'expo-router';
import { useAuth } from "@clerk/expo";
import { usePalette } from "@/ui";
import { SignInScreen } from "./SignInScreen";
import { AccountLoadFailure } from './AccountLoadFailure';
import { reportAccountFailure } from '@/lib/sentry';

/**
 * Decides between the sign-in screen and the app. Clerk restores the session
 * from secure storage on launch, so this waits for that rather than flashing
 * the sign-in screen at someone who is already signed in.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const c = usePalette();
  if (!process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY) return <View style={{ padding:24, backgroundColor:c.bg }}><Text style={{color:c.text}}>Account features need the beta account configuration. Feed me gently works without an account.</Text><Link href="/care" style={{color:c.accent,paddingVertical:20}}>Open Feed me gently</Link></View>;
  return <ConfiguredAuthGate>{children}</ConfiguredAuthGate>;
}

function ConfiguredAuthGate({ children }: { children: ReactNode }) {
  const c = usePalette();
  const { isLoaded, isSignedIn } = useAuth();
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (isLoaded) { setTimedOut(false); return; }
    const timer = setTimeout(() => { setTimedOut(true); reportAccountFailure('account-startup-timeout'); }, 12000);
    return () => clearTimeout(timer);
  }, [isLoaded]);
  // Loading/Loaded controls can both return null when Clerk enters its error
  // state. useAuth gives one exhaustive gate and keeps private routes closed.
  if (!isLoaded) {
    if (timedOut) return <AccountLoadFailure />;
    return (
        <View style={[styles.loading, { backgroundColor: c.bg }]}>
          <ActivityIndicator accessibilityLabel="Loading account" color={c.accent} />
          <Text style={{ color:c.textMuted, fontSize:16, textAlign:'center', marginTop:16 }}>Your account is still loading. Feed me gently is available without signing in.</Text>
          <Link href="/care" accessibilityRole="link" accessibilityLabel="Open Feed me gently without signing in" style={{ color:c.accent, fontSize:16, textAlign:'center', paddingVertical:16, minHeight:48 }}>Open Feed me gently</Link>
        </View>
    );
  }
  return isSignedIn ? children : <SignInScreen />;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", padding:24 },
});
