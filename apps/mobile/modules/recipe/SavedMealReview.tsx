import { useCallback, useRef, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import * as Crypto from "expo-crypto";
import { parseMealTemplateCreate, type MealTemplateCreateInput, type PairingSlot, type PairingSuggestions, type SecondsClient } from "@seconds/core/format";
import { Button, Callout, Field, Panel, PanelHeader, space, type as typeScale, usePalette } from "@/ui";

const ROLES: PairingSlot[] = ["side", "drink", "dessert"];
const LABELS: Record<PairingSlot, string> = { side: "Side", drink: "Drink", dessert: "Dessert" };

/** Optional named combination. No food log, plan, shopping or pantry writes. */
export function SavedMealReview({ recipeId, title, available, client, onPending }: {
  recipeId: string; title: string; available: boolean; client: SecondsClient; onPending: (pending: boolean) => void;
}) {
  const c = usePalette(); const router = useRouter();
  const [expanded, setExpanded] = useState(false); const [name, setName] = useState("");
  const [choices, setChoices] = useState<PairingSuggestions | null>(null);
  const [selected, setSelected] = useState<Partial<Record<PairingSlot, string>>>({});
  const [loading, setLoading] = useState(false); const [loadFailed, setLoadFailed] = useState(false);
  const [pending, setPending] = useState<MealTemplateCreateInput | null>(null);
  const [busy, setBusy] = useState(false); const [saved, setSaved] = useState(false); const [message, setMessage] = useState("");
  const focused = useRef(false); const generation = useRef(0); const action = useRef(false);
  const pendingRef = useRef<MealTemplateCreateInput | null>(null);
  useFocusEffect(useCallback(() => {
    focused.current = true; ++generation.current; action.current = false; setBusy(false); setLoading(false);
    // Do not overwrite dishes while an exact request is awaiting confirmation.
    if (!pendingRef.current) { setChoices(null); setSelected({}); setLoadFailed(false); }
    return () => {
      focused.current = false; ++generation.current;
      if (pendingRef.current) setMessage("This meal is unconfirmed. It may already be saved. Keep its exact selection for retry or check saved meals in Today.");
    };
  }, []));
  const current = (visit: number) => focused.current && generation.current === visit;
  const locked = pending !== null || busy || saved;
  const load = async () => {
    if (!available || locked || action.current || !focused.current) return;
    const visit = generation.current; action.current = true; setLoading(true); setLoadFailed(false); setChoices(null); setSelected({});
    try { const result = await client.pairings(recipeId); if (current(visit)) setChoices(result); }
    catch { if (current(visit)) setLoadFailed(true); }
    finally { if (current(visit)) { action.current = false; setLoading(false); } }
  };
  const save = async () => {
    if ((!available && !pending) || saved || action.current || !focused.current) return;
    let exact: MealTemplateCreateInput;
    try {
      exact = pending ?? parseMealTemplateCreate({ id: Crypto.randomUUID(), name, items: [
        { role: "main", recipeId }, ...ROLES.flatMap(role => selected[role] ? [{ role, recipeId: selected[role] }] : []),
      ] });
    } catch { setMessage("Review the meal name (up to 160 characters) and chosen dishes before saving."); return; }
    const visit = generation.current; action.current = true; setBusy(true); setMessage("");
    pendingRef.current = exact; setPending(exact); onPending(true);
    try {
      const result = await client.createTemplate(exact.name, exact.items, exact.id);
      if (result.id !== exact.id) throw new Error("Unconfirmed");
      if (current(visit)) { pendingRef.current = null; setPending(null); setSaved(true); onPending(false); setMessage("Meal combination saved. Find it under saved meals in Today. This did not record eating, plan a meal or change your pantry or shopping list."); }
    } catch { if (current(visit)) setMessage("We could not confirm this meal. It may already be saved. Retry the same name and dishes, or check saved meals in Today first."); }
    finally { if (current(visit)) { action.current = false; setBusy(false); } }
  };
  const discard = () => {
    const visit = generation.current;
    Alert.alert("Discard local retry request?", "The meal may already be saved. This does not delete or undo it. Check saved meals before starting another request.", [
      { text: "Keep request", style: "cancel" },
      { text: "Discard locally", onPress: () => { if (current(visit) && !action.current) { pendingRef.current = null; setPending(null); onPending(false); setMessage("Local retry request discarded. Nothing was deleted. Check saved meals before saving again."); } } },
    ]);
  };
  if (!available && !pending) return null;
  const text = { color: c.textMuted, fontSize: typeScale.body, lineHeight: 23 };
  return <Panel><PanelHeader title="Keep a familiar meal" hint="Save this recipe alone or with dishes from your library. No score, tracking or grocery order." />
    <Button label={expanded ? "Hide meal choices" : "Name and save a meal"} variant="ghost" onPress={() => setExpanded(value => !value)} />
    {expanded ? <View style={{ gap: space.sm }}>
      <Text style={text}>Main: {title}. Companion choices use saved course and cuisine labels, not current pantry or dietary settings. Review each dish's ingredients; this does not verify allergy safety.</Text>
      <Text style={text}>Meal name (optional)</Text><Field accessibilityLabel="Meal name, up to 160 characters" placeholder="For example, a familiar dinner" value={name} maxLength={160} editable={!locked && !loading && available} onChangeText={setName} />
      <Text style={text}>A blank name saves as Untitled meal. Companions are optional and none are selected for you.</Text>
      <Button label={loading ? "Loading companion dishes…" : choices ? "Refresh companion dishes" : "Find optional companion dishes"} variant="ghost" disabled={!available || locked || loading} onPress={() => void load()} />
      {loadFailed ? <Callout tone="warn">Companion dishes could not load. Try again, or deliberately save just the main recipe.</Callout> : null}
      {choices && ROLES.every(role => choices[role].length === 0) ? <Text style={text}>No companion dishes found in your library. You can save just this recipe.</Text> : null}
      {choices ? ROLES.map(role => choices[role].length ? <View key={role} style={{ gap: space.sm }}><Text accessibilityRole="header" style={text}>{LABELS[role]} (optional, choose one)</Text>{choices[role].map(dish => <View key={dish.id} style={{ gap: space.xs }}>
        <Button label={`Include ${dish.title} as ${LABELS[role].toLowerCase()}`} variant="toggle" selected={selected[role] === dish.id} disabled={locked || loading || !available} onPress={() => setSelected(value => ({ ...value, [role]: value[role] === dish.id ? undefined : dish.id }))} />
        <Button label={`Review ${dish.title}`} variant="ghost" disabled={busy || loading} onPress={() => router.push({ pathname: "/recipe/[id]", params: { id: dish.id } })} />
      </View>)}</View> : null) : null}
      <Button label={busy ? "Saving meal…" : saved ? "Meal saved ✓" : pending ? "Retry this exact meal" : "Save this meal combination"} disabled={busy || loading || saved || (!available && !pending)} onPress={() => void save()} />
      <Text style={text}>Saving only stores the combination. Leaving this recipe or changing accounts loses local retry state; a previous request may still finish.</Text>
      {pending ? <><Text style={text}>Unconfirmed request: {pending.name}, {pending.items.length} {pending.items.length === 1 ? "dish" : "dishes"}. Name and dish changes are paused until confirmation or deliberate local discard.</Text><Button label="Discard local retry request" variant="ghost" disabled={busy} onPress={discard} /></> : null}
      <Button label="Check saved meals in Today" variant="ghost" disabled={busy} onPress={() => router.push("/(protected)/today")} />
    </View> : null}
    {message ? <Callout tone={pending ? "warn" : "info"}>{message}</Callout> : null}
  </Panel>;
}
