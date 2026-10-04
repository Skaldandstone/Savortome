import { useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { getClerkInstance, useAuth } from "@clerk/expo";
import { createNativeFoodNoteRecovery } from "@/lib/nativeFoodNoteRecovery";
import { Button, Callout } from "@/ui";

export function SignOutButton() {
  const { signOut, userId, sessionId } = useAuth();
  const identity = useRef({ userId, sessionId }); identity.current = { userId, sessionId };
  const mounted = useRef(true); const action = useRef(false); const prompt = useRef(false);
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    mounted.current = true; action.current = false; prompt.current = false; setBusy(false); setError(null);
    return () => {
      mounted.current = false;
      if (warningTimer.current !== null) clearTimeout(warningTimer.current);
      warningTimer.current = null;
    };
  }, [userId, sessionId]);
  const begin = () => {
    if (action.current || !userId || !sessionId) return;
    const owner = userId, session = sessionId;
    const sameView = () => mounted.current && identity.current.userId === owner && identity.current.sessionId === session;
    const current = () => {
      if (!sameView()) return false;
      try {
        const active = getClerkInstance().session;
        return active?.user.id === owner && active.id === session;
      } catch { return false; } // Unavailable auth must never authorize an operation.
    };
    action.current = true; prompt.current = true; setError(null);
    const cancel = () => { if (sameView() && prompt.current) { prompt.current = false; action.current = false; } };
    const finish = async (discard: boolean) => {
      if (!prompt.current || !sameView()) return;
      prompt.current = false;
      if (!current()) {
        action.current = false;
        setError("Your account session could not be confirmed. Sign-out and device discard were not started. Check your account before trying again.");
        return;
      }
      setBusy(true);
      let clearing = discard;
      let timer: ReturnType<typeof setTimeout> | null = null;
      try {
        if (discard) await createNativeFoodNoteRecovery(owner, session).discard(true);
        if (!current()) {
          if (sameView()) setError("Your account session could not be confirmed. Sign-out was not started. A confirmed device discard is not undone.");
          return; // Never sign a replacement account/session out.
        }
        clearing = false;
        // This warns about a stalled SDK call; it cannot cancel it or permit a duplicate.
        timer = setTimeout(() => {
          if (sameView()) setError("Sign-out is still pending and may still finish. Another sign-out request will not be started while this one is pending. A confirmed device discard is not undone.");
        }, 12_000);
        warningTimer.current = timer;
        await signOut({ sessionId: session });
        if (sameView()) setError(null);
      } catch {
        if (sameView()) setError(clearing
          ? "Device-copy discard was not confirmed and may still finish. Sign-out was not started. Try again, or choose sign out without clearing. Saved account notes were not removed."
          : "Sign-out was not confirmed. Check your account before trying again. A confirmed device discard is not undone.");
      } finally {
        if (timer !== null) clearTimeout(timer);
        if (warningTimer.current === timer) warningTimer.current = null;
        if (sameView()) { action.current = false; setBusy(false); }
      }
    };
    Alert.alert("Sign out of Savortome?", "Optional food-note device copies stay on this device unless discarded. Discard affects only this account in the current app environment, not saved account notes or other devices. Earlier account/local operations are not cancelled and may still finish. Check device recovery in Today when you return.", [
      { text: "Cancel", style: "cancel", onPress: cancel },
      { text: "Sign out without clearing", onPress: () => void finish(false) },
      { text: "Discard copy and sign out", style: "destructive", onPress: () => void finish(true) },
    ], { cancelable: true, onDismiss: cancel });
  };
  return <View style={{ flexShrink: 1, maxWidth: 240 }}>
    <Button label={busy ? "Signing out…" : "Sign out"} busy={busy} variant="ghost" disabled={busy || !userId || !sessionId} onPress={begin} />
    {error ? <Callout tone="error">{error}</Callout> : null}
  </View>;
}
