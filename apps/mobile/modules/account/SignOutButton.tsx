import { useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { getClerkInstance, useAuth } from "@clerk/expo";
import { createNativePantryRecovery } from "@/lib/nativePantryRecovery";
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
    let stage: "food" | "pantry" | "done" = "food";
    const cancel = (expected: "food" | "pantry") => { if (sameView() && prompt.current && stage === expected) { prompt.current = false; action.current = false; } };
    const finish = async (discard: boolean, discardPantry: boolean) => {
      if (!prompt.current || !sameView() || stage !== "pantry") return;
      stage = "done"; prompt.current = false;
      if (!current()) {
        action.current = false;
        setError("Your account session could not be confirmed. Sign-out and device discard were not started. Check your account before trying again.");
        return;
      }
      setBusy(true);
      let clearing = discard || discardPantry;
      let releasePantry: (() => void) | undefined;
      let timer: ReturnType<typeof setTimeout> | null = null;
      try {
        const pantry = createNativePantryRecovery(owner, session);
        releasePantry = pantry.holdSession();
        if (discardPantry) await pantry.discard(true);
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
        releasePantry?.();
        if (timer !== null) clearTimeout(timer);
        if (warningTimer.current === timer) warningTimer.current = null;
        if (sameView()) { action.current = false; setBusy(false); }
      }
    };
    const choosePantry = (discardFood: boolean) => {
      if (!prompt.current || !sameView() || stage !== "food") return;
      stage = "pantry";
      Alert.alert("Pantry recovery on sign-out", "Clear this account's pantry recovery copy on this device (recommended), or explicitly keep it for the next sign-in to this same account. Copies expire after 24 hours and are removed on the next access; no background or other-device erasure is promised. Saved pantry reviews are not removed.", [
        { text: "Cancel", style: "cancel", onPress: () => cancel("pantry") },
        { text: "Clear pantry copy and sign out", style: "destructive", onPress: () => void finish(discardFood, true) },
        { text: "Keep pantry copy and sign out", onPress: () => void finish(discardFood, false) },
      ], { cancelable: true, onDismiss: () => cancel("pantry") });
    };
    Alert.alert("Sign out of Savortome?", "Optional food-note device copies stay on this device unless discarded. Discard affects only this account in the current app environment, not saved account notes or other devices. Earlier account/local operations are not cancelled and may still finish. The next step asks separately about pantry recovery. Check food-note recovery in Today when you return.", [
      { text: "Cancel", style: "cancel", onPress: () => cancel("food") },
      { text: "Keep food-note copy; next", onPress: () => choosePantry(false) },
      { text: "Discard food-note copy; next", style: "destructive", onPress: () => choosePantry(true) },
    ], { cancelable: true, onDismiss: () => cancel("food") });
  };
  return <View style={{ flexShrink: 1, maxWidth: 240 }}>
    <Button label={busy ? "Signing out…" : "Sign out"} busy={busy} variant="ghost" disabled={busy || !userId || !sessionId} onPress={begin} />
    {error ? <Callout tone="error">{error}</Callout> : null}
  </View>;
}
