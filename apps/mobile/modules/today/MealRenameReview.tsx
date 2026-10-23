import { useCallback, useRef, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { parseMealTemplateRename, type MealTemplate, type MealTemplateRenameInput, type SecondsClient } from "@seconds/core/format";
import { Button, Callout, Field, space, type as typeScale, usePalette } from "@/ui";

/** Explicit names only, with local exact-retry state retained while mounted. */
export function MealRenameReview({ meal, client, disabled, onPending, onConfirmed, onReview }: {
  meal: MealTemplate; client: SecondsClient; disabled: boolean;
  onPending: (pending: boolean) => void;
  onConfirmed: (name: string) => void;
  onReview: () => void;
}) {
  const c = usePalette();
  const [expanded, setExpanded] = useState(false); const [draft, setDraft] = useState(meal.name);
  const [pending, setPending] = useState<MealTemplateRenameInput | null>(null);
  const pendingRef = useRef<MealTemplateRenameInput | null>(null);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  const focused = useRef(false); const visit = useRef(0); const action = useRef(false);
  useFocusEffect(useCallback(() => {
    focused.current = true; ++visit.current; action.current = false; setBusy(false);
    if (pendingRef.current) setMessage("This name is unconfirmed and may already be saved. Retry the identical request or discard the local retry and reload saved meals to review.");
    return () => { focused.current = false; ++visit.current; };
  }, []));
  const current = (version: number) => focused.current && visit.current === version;

  const save = async () => {
    if (!focused.current || action.current || (disabled && !pending)) return;
    let exact: MealTemplateRenameInput;
    try { exact = pending ?? parseMealTemplateRename({ previousName: meal.name, name: draft }); }
    catch { setMessage("Enter a name of one to 160 characters, without control characters."); return; }
    if (!pending && exact.name === meal.name) { setMessage("This is already the saved name."); return; }
    const version = ++visit.current; action.current = true; setBusy(true);
    pendingRef.current = exact; setPending(exact); onPending(true); setMessage("");
    try {
      const result = await client.renameTemplate(meal.id, exact);
      if (result.confirmed?.id !== meal.id || result.confirmed.name !== exact.name) throw new Error("Unconfirmed");
      if (current(version)) {
        pendingRef.current = null; setPending(null); onConfirmed(exact.name); onPending(false);
        setExpanded(false); setMessage("Meal name saved. Its dishes and sharing settings have not changed.");
      }
    } catch {
      if (current(version)) setMessage("We could not confirm this name. It may already be saved, or the meal may have changed. Nothing retries automatically. Retry the identical request or reload saved meals to review before another change.");
    } finally {
      if (current(version)) { action.current = false; setBusy(false); }
    }
  };

  const text = { color: c.textMuted, fontSize: typeScale.body, lineHeight: 23 };
  return <View style={{ gap: space.sm }}>
    {!expanded ? <Button label={`Rename ${meal.name}`} variant="ghost" disabled={disabled} onPress={() => {
      if (!focused.current || action.current || pendingRef.current) return;
      setDraft(meal.name); setMessage(""); setExpanded(true);
    }} /> : <>
      <Text style={{ ...text, color: c.text }}>Meal name</Text>
      <Field accessibilityLabel="Saved meal name" value={draft} maxLength={160} editable={!disabled && !busy && !pending} onChangeText={setDraft} />
      <Text style={text}>Give this familiar combination a name you recognize. An existing shared link will display the new title; who can see it stays the same. No eating, plan or pantry record is changed.</Text>
      {pending ? <Text style={text}>Requested: {pending.name}. Last confirmed: {meal.name}. The current saved name is not yet confirmed. Leaving Today may lose this local retry while the earlier request still finishes.</Text> : null}
      <Button label={busy ? "Saving meal name…" : pending ? "Retry identical name request" : "Save meal name"} disabled={busy || (disabled && !pending)} onPress={() => void save()} />
      {!pending ? <Button label="Cancel rename" variant="ghost" disabled={busy} onPress={() => {
        if (!focused.current || action.current) return;
        setExpanded(false); setDraft(meal.name); setMessage("");
      }} /> : <Button label="Discard local retry and review saved meals" variant="ghost" disabled={busy} onPress={() => {
        if (!focused.current || action.current || !pendingRef.current) return;
        const version = visit.current;
        Alert.alert("Review an unconfirmed name?", "Discard only this local retry? The earlier rename is not cancelled and may still finish. Reload saved meals and recheck the name before making another change.", [
          { text: "Keep request", style: "cancel" },
          { text: "Discard locally", onPress: () => {
            if (!current(version) || action.current || !pendingRef.current) return;
            pendingRef.current = null; setPending(null); onPending(false); onReview();
          } },
        ]);
      }} />}
    </>}
    {message ? <Callout tone="info">{message}</Callout> : null}
  </View>;
}
