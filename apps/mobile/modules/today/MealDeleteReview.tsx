import { useCallback, useRef, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import type { MealTemplate, SecondsClient } from "@seconds/core/format";
import { Button, Callout, space, type as typeScale, usePalette } from "@/ui";

/** Delete the grouping only; an uncertain response requires collection review. */
export function MealDeleteReview({ meal, client, disabled, onPending, onConfirmed, onReview }: {
  meal: MealTemplate; client: SecondsClient; disabled: boolean;
  onPending: (pending: boolean) => void;
  onConfirmed: () => void;
  onReview: () => void;
}) {
  const c = usePalette();
  const focused = useRef(false); const visit = useRef(0); const action = useRef(false);
  const disabledRef = useRef(disabled); disabledRef.current = disabled;
  const pendingRef = useRef(false);
  const [pending, setPending] = useState(false); const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useFocusEffect(useCallback(() => {
    focused.current = true; ++visit.current; action.current = false; setBusy(false);
    if (pendingRef.current) setMessage("Deletion is unconfirmed. This combination may already be deleted. Reload saved meals to review before another change; no deletion retries automatically.");
    return () => { focused.current = false; ++visit.current; };
  }, []));
  const current = (version: number) => focused.current && visit.current === version;

  const remove = async (version: number) => {
    if (!current(version) || action.current || disabledRef.current || pendingRef.current) return;
    action.current = true; pendingRef.current = true;
    setPending(true); setBusy(true); onPending(true); setMessage("");
    try {
      const result = await client.deleteTemplate(meal.id);
      if (result.ok !== true) throw new Error("Unconfirmed");
      if (current(version)) {
        pendingRef.current = false; setPending(false); onPending(false); onConfirmed();
      }
    } catch {
      if (current(version)) setMessage("We could not confirm deletion. The combination may already be deleted. Its recipes are not removed by this action. Reload saved meals to review; nothing retries automatically.");
    } finally {
      if (current(version)) { action.current = false; setBusy(false); }
    }
  };

  const text = { color: c.textMuted, fontSize: typeScale.body, lineHeight: 23 };
  return <View style={{ gap: space.sm }}>
    {!pending ? <Button label={`Delete saved combination: ${meal.name}`} variant="ghost" disabled={disabled || busy} onPress={() => {
      if (!focused.current || action.current || disabledRef.current || pendingRef.current) return;
      const version = visit.current;
      Alert.alert("Delete this saved combination?", `Delete ${meal.name}? Its recipes stay in your library. This removes the grouping and stops its shared link from working. Your existing plan, food notes and pantry are unchanged.`, [
        { text: "Keep it", style: "cancel" },
        { text: "Delete combination", style: "destructive", onPress: () => { void remove(version); } },
      ]);
    }} /> : <>
      <Text accessibilityLiveRegion="polite" style={text}>{busy ? "Deleting saved combination…" : "Deletion remains unconfirmed."}</Text>
      <Text style={text}>Other saved-meal actions are paused. Leaving Today may lose this local warning while the earlier request still finishes.</Text>
      <Button label="Review unconfirmed deletion" variant="ghost" disabled={busy} onPress={() => {
        if (!focused.current || action.current) return;
        const version = visit.current;
        Alert.alert("Reload to review?", "Discard only this local warning and reload saved meals? The earlier deletion is not cancelled or undone and may still finish. Recheck the collection before making another change.", [
          { text: "Keep warning", style: "cancel" },
          { text: "Review collection", onPress: () => {
            if (!current(version) || action.current) return;
            pendingRef.current = false; setPending(false); onPending(false); onReview();
          } },
        ]);
      }} />
    </>}
    {message ? <Callout tone="warn">{message}</Callout> : null}
  </View>;
}
