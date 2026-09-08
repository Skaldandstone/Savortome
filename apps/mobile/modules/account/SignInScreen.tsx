import { useState } from "react";
import { Link } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useHostedAuth } from "@clerk/expo/hosted-auth";
import { Button, Callout, Panel, PanelHeader, space, type as typeScale, usePalette } from "@/ui";

/**
 * Sign-in runs through Clerk's hosted Account Portal in a browser session.
 *
 * That means the app never handles a password or a verification code, and it
 * automatically supports whatever sign-in methods the Clerk instance has turned
 * on, without a custom form per method.
 */
export function SignInScreen() {
  const { startHostedAuth } = useHostedAuth();
  const [busy, setBusy] = useState<"sign-in" | "sign-up" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const c = usePalette();

  const start = async (mode: "sign-in" | "sign-up") => {
    setBusy(mode);
    setError(null);
    try {
      const { createdSessionId } = await startHostedAuth({ mode });
      // A cancelled browser session is a normal outcome, not a failure.
      if (!createdSessionId) setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in didn't complete.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <Text style={[styles.wordmark, { color: c.text }]}>Second Breakfast</Text>
      <Text style={[styles.tagline, { color: c.textMuted }]}>recipes, from anywhere</Text>
      {process.env.EXPO_PUBLIC_WOODLAND_BETA === 'true' && <Link href="/care" style={{color:c.accent,paddingVertical:16}}>Feed me gently without signing in</Link>}

      <Panel style={styles.panel}>
        <PanelHeader
          title="Sign in to keep your recipes"
          hint="Your shelves, ratings, and imports follow you across the web app and here."
        />

        <View style={styles.actions}>
          <Button
            label={busy === "sign-in" ? "Opening…" : "Sign in"}
            disabled={busy !== null}
            onPress={() => void start("sign-in")}
          />
          <Button
            label="Create an account"
            variant="ghost"
            disabled={busy !== null}
            onPress={() => void start("sign-up")}
          />
        </View>

        {busy ? <ActivityIndicator accessibilityLabel="Signing in" style={styles.spinner} color={c.accent} /> : null}
        {error ? <Callout tone="error" title="Couldn't sign in">{error}</Callout> : null}
      </Panel>
      <Link href="/legal" style={{ color: c.text, paddingVertical: 16, minHeight: 48 }}>About Second Breakfast and legal</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: "center", padding: space.lg + 4 },
  wordmark: { fontSize: typeScale.display, fontWeight: "700", letterSpacing: -0.5 },
  tagline: { fontSize: 14, marginBottom: space.xl },
  panel: { marginTop: space.md },
  actions: { flexDirection: "row", gap: space.md, alignItems: "center", flexWrap: "wrap" },
  spinner: { marginTop: space.md, alignSelf: "flex-start" },
});
