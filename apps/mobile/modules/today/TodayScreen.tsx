import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "@clerk/expo";
import * as Crypto from "expo-crypto";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { foodLogDate, localFoodDate, parseFoodLogInput, planIngredientName, type FoodLogInput, type FoodLogEntry, type FoodLogSource, type PlanTogetherIdea, type PlanTogetherOptions } from "@seconds/core/format";
import { createAccountClient } from "@/lib/client";
import { Button, Callout, Field, Panel, PanelHeader, space, type as typeScale, usePalette } from "@/ui";
import { FoodNoteCapture } from "./FoodNoteCapture";
import { MissingShoppingReview } from "./MissingShoppingReview";
import { PlanIdeaReview } from "./PlanIdeaReview";

function ask(message: string, confirm: string): Promise<boolean> {
  return new Promise(resolve => Alert.alert("Check before continuing", message, [
    { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
    { text: confirm, onPress: () => resolve(true) },
  ], { cancelable: true, onDismiss: () => resolve(false) }));
}
export function TodayScreen() {
  const { userId } = useAuth();
  return <AccountTodayScreen key={userId ?? "signed-out"} />;
}

function AccountTodayScreen() {
  const { userId } = useAuth();
  const client = useMemo(() => userId ? createAccountClient(userId) : null, [userId]);
  const c = usePalette(); const insets = useSafeAreaInsets(); const router = useRouter();
  const generation = useRef(0); const mounted = useRef(true); const focused = useRef(true);
  const [focusVisit, setFocusVisit] = useState(0);
  const [date, setDate] = useState(() => localFoodDate());
  const [notes, setNotes] = useState<FoodLogEntry[]>([]);
  const [dayNotes, setDayNotes] = useState<FoodLogEntry[]>([]);
  const [dayState, setDayState] = useState<"loading" | "ready" | "failed">("loading");
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState(""); const [portion, setPortion] = useState("");
  const [source, setSource] = useState<FoodLogSource>("text");
  const [uncertainty, setUncertainty] = useState("");
  const [busy, setBusy] = useState(false); const [captureBusy, setCaptureBusy] = useState(false);
  const [error, setError] = useState<string | null>(null); const [message, setMessage] = useState<string | null>(null);
  const [invitation, setInvitation] = useState(true);
  const [ideas, setIdeas] = useState<PlanTogetherIdea[] | null>(null);
  const [ideasBusy, setIdeasBusy] = useState(false); const [ideasError, setIdeasError] = useState<string | null>(null);
  const [maxMinutes, setMaxMinutes] = useState<PlanTogetherOptions["maxMinutes"]>();
  const [pantryOnly, setPantryOnly] = useState(false);
  const [useIngredient, setUseIngredient] = useState("");
  const [skipIngredient, setSkipIngredient] = useState("");
  const [ingredientSummary, setIngredientSummary] = useState("");
  const ideasAction = useRef(false);
  const [shoppingPending, setShoppingPending] = useState<Record<string, boolean>>({});
  const hasShoppingPending = Object.values(shoppingPending).some(Boolean);
  const id = useRef<string | null>(null);
  const pendingSave = useRef<FoodLogInput | null>(null);
  const action = useRef(false);
  const readVersion = useRef(0);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const draftTitle = useRef(title); draftTitle.current = title;
  const current = (version: number) => mounted.current && focused.current && generation.current === version;
  useFocusEffect(useCallback(() => {
    focused.current = true; action.current = false; ideasAction.current = false; setCaptureBusy(false); setBusy(false); setIdeasBusy(false); setLoading(false); setFocusVisit(value => value + 1);
    return () => { focused.current = false; ++generation.current; };
  }, []));
  const load = useCallback(async () => {
    if (!client) return;
    const version = generation.current;
    const read = ++readVersion.current;
    setLoading(true); setLoadError(null);
    try {
      const pending = pendingSave.current;
      const result = await client.listFoodNotes();
      const savedDay = pending ? await client.listFoodNotes(pending.date) : [];
      if (current(version) && readVersion.current === read) {
        setNotes(result); setLoaded(true);
        if (pending && pendingSave.current === pending && savedDay.some(note => note.id === pending.id && note.date === pending.date && note.title === pending.title && note.portion === pending.portion && note.source === pending.source)) {
          pendingSave.current = null; setUnconfirmed(false); id.current = pending.id;
          setError(null);
          setMessage("Reload confirmed your note was saved. The draft is still here if you want to edit it; discarding it will not remove the saved note.");
        }
      }
    }
    catch { if (current(version) && readVersion.current === read) setLoadError("Food notes could not load. Nothing has been deleted. Reload before saving another note."); }
    finally { if (current(version) && readVersion.current === read) setLoading(false); }
  }, [client]);
  useEffect(() => {
    mounted.current = true; ++generation.current;
    pendingSave.current = null; action.current = false; ++readVersion.current; setUnconfirmed(false);
    setNotes([]); setLoaded(false); setTitle(""); setPortion(""); setDate(localFoodDate()); setSource("text"); setUncertainty(""); id.current = null;
    setIdeas(null); setIdeasError(null); setMessage(null); setError(null); setInvitation(true); setBusy(false); setCaptureBusy(false);
    void load();
    return () => { mounted.current = false; ++generation.current; };
  }, [client, load]);
  useEffect(() => { if (focusVisit > 0) void load(); }, [focusVisit, load]);
  useEffect(() => {
    let cancelled = false;
    const version = generation.current; setDayNotes([]); setDayState("loading");
    try { foodLogDate(date); } catch { setDayState("failed"); return; }
    if (!client) { setDayState("failed"); return; }
    void client.listFoodNotes(date).then(result => { if (!cancelled && current(version)) { setDayNotes(result); setDayState("ready"); } })
      .catch(() => { if (!cancelled && current(version)) setDayState("failed"); });
    return () => { cancelled = true; };
  }, [date, notes, client, focusVisit]);
  const confirmReplace = useCallback(async () => !pendingSave.current && (!draftTitle.current.trim() || await ask("Replace the current unsaved food draft?", "Replace draft")), []);
  const save = async () => {
    if (!client || action.current || captureBusy || !loaded) return;
    let input: FoodLogInput;
    try {
      id.current ??= Crypto.randomUUID();
      input = pendingSave.current ?? parseFoodLogInput({ id: id.current, date, title, portion: portion.trim() || null, source });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Review the name and date before saving."); return; }
    action.current = true; ++readVersion.current; setLoading(false);
    pendingSave.current = input; setUnconfirmed(true);
    const version = generation.current; setBusy(true); setError(null); setMessage(null);
    try {
      const entry = await client.saveFoodNote(input);
      if (!current(version)) return;
      setNotes(existing => [entry, ...existing.filter(note => note.id !== entry.id)]);
      pendingSave.current = null; setUnconfirmed(false);
      setTitle(""); setPortion(""); setUncertainty(""); setSource("text"); id.current = null;
      setMessage("Food note saved. Your pantry was not changed.");
    } catch { if (current(version)) setError("We could not confirm the note saved. Your draft is still here. Reload notes before retrying; you may need to sign in again."); }
    finally { if (current(version)) { action.current = false; setBusy(false); } }
  };
  const remove = async (note: FoodLogEntry) => {
    if (!client || action.current || captureBusy || pendingSave.current) return;
    const version = generation.current;
    action.current = true;
    if (!await ask(`Remove the food note for ${note.title}? Pantry and plans will stay unchanged.`, "Remove note") || !current(version)) { if (current(version)) action.current = false; return; }
    ++readVersion.current; setLoading(false);
    setBusy(true); setError(null); setMessage(null);
    try { await client.deleteFoodNote(note.id); if (current(version)) { setNotes(existing => existing.filter(item => item.id !== note.id)); setMessage("Food note removed."); } }
    catch { if (current(version)) setError("We could not confirm removal. Reload food notes to check."); }
    finally { if (current(version)) { action.current = false; setBusy(false); } }
  };
  const repeatOrEdit = async (note: FoodLogEntry, edit: boolean) => {
    if (action.current || captureBusy || pendingSave.current) return;
    const version = generation.current;
    action.current = true;
    if (!await confirmReplace() || !current(version)) { if (current(version)) action.current = false; return; }
    action.current = false;
    setTitle(note.title); setPortion(note.portion ?? ""); setSource(edit ? note.source : "repeat"); setUncertainty("");
    id.current = edit ? note.id : null;
    if (edit) setDate(note.date);
    setMessage(edit ? "Editing an existing note. Save to confirm changes." : "New repeat draft ready. Nothing saved yet.");
  };
  const showIdeas = async () => {
    if (!client || ideasAction.current || hasShoppingPending) return;
    const ingredientOptions = { useIngredient: useIngredient.trim() || undefined, skipIngredient: skipIngredient.trim() || undefined };
    let normalizedIngredients;
    try { normalizedIngredients = { useIngredient: planIngredientName(useIngredient), skipIngredient: planIngredientName(skipIngredient) }; }
    catch { setIdeas(null); setIdeasError("Enter one ingredient name per field, up to 100 characters, without commas, semicolons or alternatives."); return; }
    ideasAction.current = true; setIdeas(null);
    const version = generation.current; setIdeasBusy(true); setIdeasError(null);
    try { const result = await client.planTogether({ strictDietary: true, maxMinutes, pantryOnly, ...ingredientOptions }); if (current(version)) {
      setIdeas(result.ideas);
      setIngredientSummary(`Ingredient names used for matching: use ${normalizedIngredients.useIngredient ?? "any"}; skip ${normalizedIngredients.skipIngredient ?? "none"}.`);
    } }
    catch { if (current(version)) setIdeasError("Meal ideas or saved dietary settings could not load. Try again or use Feed me gently with temporary choices."); }
    finally { if (current(version)) { ideasAction.current = false; setIdeasBusy(false); } }
  };
  const todayNotes = dayNotes;
  const recent = notes.filter((note, index) => notes.findIndex(other => other.title === note.title && other.portion === note.portion) === index).slice(0, 3);
  const textStyle = { color: c.textMuted, fontSize: typeScale.body, lineHeight: 23 };
  const disabled = busy || captureBusy;
  const lockedDraft = disabled || unconfirmed;
  return <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]} keyboardShouldPersistTaps="handled">
    <Button label="Back to cooking" variant="ghost" onPress={() => router.replace("/(protected)/(tabs)/cook")} />
    <Text accessibilityRole="header" style={[styles.heading, { color: c.text }]}>Today, at your pace</Text>
    <Text style={textStyle}>A meal idea or a little memory aid. Use what helps, leave what doesn’t.</Text>
    {invitation ? <Panel>
      <PanelHeader title="Want to plan something to eat together?" hint="Start with what your pantry thinks is still there. Correct it, choose something else, or leave this for later." />
      <Text style={textStyle}>Optional time limit</Text>
      <View style={styles.row}><Button label="No time limit" variant="toggle" selected={maxMinutes === undefined} disabled={ideasBusy || hasShoppingPending} onPress={() => { setMaxMinutes(undefined); setIdeas(null); setIdeasError(null); }} />
        {([10, 20, 30, 60] as const).map(minutes => <Button key={minutes} label={`Up to ${minutes} min`} variant="toggle" selected={maxMinutes === minutes} disabled={ideasBusy || hasShoppingPending} onPress={() => { setMaxMinutes(minutes); setIdeas(null); setIdeasError(null); }} />)}</View>
      <Button label="No shopping today: match pantry names only" variant="toggle" selected={pantryOnly} disabled={ideasBusy || hasShoppingPending} onPress={() => { setPantryOnly(value => !value); setIdeas(null); setIdeasError(null); }} />
      <Text style={textStyle}>Use this ingredient (optional)</Text>
      <Field accessibilityLabel="Use this ingredient for meal ideas" value={useIngredient} maxLength={100} placeholder="For example, bananas" editable={!ideasBusy && !hasShoppingPending} onChangeText={value => { setUseIngredient(value); setIdeas(null); setIdeasError(null); }} />
      <Text style={textStyle}>Skip this ingredient today (optional)</Text>
      <Field accessibilityLabel="Skip this ingredient for today's meal ideas" value={skipIngredient} maxLength={100} placeholder="For example, mushrooms" editable={!ideasBusy && !hasShoppingPending} onChangeText={value => { setSkipIngredient(value); setIdeas(null); setIdeasError(null); }} />
      <Text style={textStyle}>These ingredient choices apply only to this search. They do not change your pantry or dietary profile. Matching checks whether a recipe lists a normalized ingredient name, including optional ingredients. It does not confirm amounts, preparation or hidden ingredients; an optional ingredient may not be used. Skipping a name does not verify allergy safety; use your dietary profile for allergens and check labels.</Text>
      <Text style={textStyle}>Time uses the saved total; check the steps for waiting time. Unknown times are excluded with a limit. No-shopping matches check every listed ingredient, including staples and optional items. Names do not confirm quantities or preparation. We check up to 40 saved recipe candidates, not necessarily your whole library.</Text>
      <View style={styles.row}><Button label={ideasBusy ? "Finding ideas…" : "Show me some ideas"} disabled={ideasBusy || hasShoppingPending} onPress={() => void showIdeas()} />
        <Button label="Not now" variant="ghost" disabled={hasShoppingPending} onPress={() => setInvitation(false)} /><Button label="Feed me gently" variant="ghost" onPress={() => router.push("/care")} /></View>
      {ideasError ? <Callout tone="error">{ideasError}</Callout> : null}
      {ideas !== null ? <Text accessibilityLiveRegion="polite" style={textStyle}>{ingredientSummary}</Text> : null}
      {ideas?.length === 0 ? <Text style={textStyle}>No suitable saved recipe matched. Browse starter recipes or choose something simple. Restrictions weren’t loosened.</Text> : null}
      {ideas?.map(idea => <View key={idea.recipeId} style={[styles.note, { borderColor: c.border }]}>
        <Text accessibilityRole="header" style={{ color: c.text, fontSize: typeScale.title }}>{idea.title}</Text>
        <Text style={textStyle}>{idea.totalMinutes === null ? "Total time not recorded" : `${idea.totalMinutes} minutes total`}</Text>
        <Text style={textStyle}>{idea.reason}</Text><Text style={textStyle}>Pantry names matched: {idea.have.join(", ") || "none"}. Still needed: {idea.missing.join(", ") || "no additional names identified"}.</Text>
        {client ? <MissingShoppingReview missing={idea.missing} client={client} onPending={pending => setShoppingPending(current => ({ ...current, [idea.recipeId]: pending }))} /> : null}
        {client ? <PlanIdeaReview recipeId={idea.recipeId} title={idea.title} client={client} onPending={pending => setShoppingPending(current => ({ ...current, [`plan:${idea.recipeId}`]: pending }))} /> : null}
        <Button label={`View ${idea.title}`} variant="ghost" onPress={() => router.push(`/recipe/${idea.recipeId}`)} />
      </View>)}
      {ideas?.length ? <Text style={textStyle}>Matches require explicit saved dietary tags and exclude detected allergen conflicts. Tags may be incomplete or wrong. Name matching ignores quantities and preparation. Check package labels; suggestions do not verify allergy safety.</Text> : null}
      <View style={styles.row}><Button label="Browse starter recipes" variant="ghost" onPress={() => router.push("/(protected)/(tabs)/discover")} /><Button label="Open meal plan" variant="ghost" onPress={() => router.push("/(protected)/(tabs)/plan")} /></View>
    </Panel> : <Button label="Show the meal-planning invitation" variant="ghost" onPress={() => setInvitation(true)} />}
    <Panel>
      <PanelHeader title="An optional food note" hint="A memory aid, not a score. No calorie goals, streaks or automatic pantry updates." />
      <View style={styles.fields}>
        {loading ? <Text accessibilityLiveRegion="polite" style={textStyle}>Loading food notes…</Text> : null}
        {loadError ? <Callout tone="error">{loadError}</Callout> : null}
        <Button label="Reload food notes" variant="ghost" disabled={disabled || loading} onPress={() => void load()} />
        <Text style={textStyle}>Date (YYYY-MM-DD)</Text><Field value={date} accessibilityLabel="Food note date, YYYY-MM-DD" editable={!lockedDraft} maxLength={10} onChangeText={setDate} />
        <Text style={textStyle}>Food name</Text><Field value={title} accessibilityLabel="Food name" editable={!lockedDraft} maxLength={160} onChangeText={value => { setTitle(value); setSource("text"); }} />
        <Text style={textStyle}>Portion, if you know it (optional)</Text><Field value={portion} accessibilityLabel="Portion, optional" editable={!lockedDraft} maxLength={120} onChangeText={setPortion} placeholder="One bowl; leave blank if unsure" />
        {uncertainty ? <Callout tone="warn">{uncertainty} Photo portions stay unknown unless you enter one.</Callout> : null}
        {unconfirmed && !busy ? <Callout tone="warn">The save was not confirmed. This draft stays unchanged for a retry with the same reference. Reload first to check whether it already saved.</Callout> : null}
        <View style={styles.row}><Button label={busy ? "Saving…" : unconfirmed ? "Retry the same food note" : id.current ? "Save reviewed edits" : "Save food note"} disabled={disabled || !loaded || !title.trim()} onPress={() => void save()} />
          <Button label="Discard draft" variant="ghost" disabled={disabled || !title} onPress={() => {
            const version = generation.current;
            void (async () => {
              if (action.current) return;
              action.current = true;
              const discard = !pendingSave.current || await ask("The note may already have saved. Discard this local draft only? Reload notes before adding it again.", "Discard local draft");
              if (!current(version)) return;
              action.current = false; if (!discard) return;
              pendingSave.current = null; setUnconfirmed(false); setTitle(""); setPortion(""); setSource("text"); setUncertainty(""); id.current = null; setMessage("Local draft discarded. Saved notes were not removed."); setError(null);
            })();
          }} /></View>
        {message ? <Callout tone="info">{message}</Callout> : null}{error ? <Callout tone="error">{error}</Callout> : null}
      </View>
    </Panel>
    {client ? <FoodNoteCapture key={userId} client={client} disabled={busy || unconfirmed} onBusy={setCaptureBusy} confirmReplace={confirmReplace} onDraft={(draft, kind) => {
      if (pendingSave.current || action.current) return;
      setTitle(draft.title); setPortion(draft.portion ?? ""); setSource(kind); setUncertainty(draft.uncertainty); id.current = null;
      setMessage("Draft ready. Check the name and portion before saving. Nothing has been saved.");
    }} /> : null}
    <Panel><PanelHeader title="Your recent notes for this day" hint="Up to 30 notes for the selected date. They record what you told us, not what remains in your pantry." />
      {dayState === "loading" ? <Text accessibilityLiveRegion="polite" style={textStyle}>Loading this day's notes…</Text> : null}
      {dayState === "failed" ? <Callout tone="error">This day's notes could not load. Check the date or reload; an empty display does not mean notes were deleted.</Callout> : null}
      {dayState === "ready" && !todayNotes.length ? <Text style={textStyle}>No notes for this day. Leaving this empty is fine.</Text> : null}
      {todayNotes.map(note => <View style={[styles.note, { borderColor: c.border }]} key={note.id}><Text accessibilityRole="header" style={{ color: c.text, fontSize: typeScale.title }}>{note.title}</Text><Text style={textStyle}>{note.portion ?? "Portion not recorded"}</Text>
        <View style={styles.row}><Button label={`Edit ${note.title} note`} variant="ghost" disabled={lockedDraft} onPress={() => void repeatOrEdit(note, true)} /><Button label={`Remove ${note.title} note`} variant="ghost" disabled={lockedDraft} onPress={() => void remove(note)} /></View>
      </View>)}
    </Panel>
    {loaded && recent.length ? <Panel><PanelHeader title="Something familiar" hint="Copy a previous food note into a new draft. It only records another meal when you explicitly save." />
      {recent.map(note => <Button key={note.id} label={`Use ${note.title} as a new draft`} variant="ghost" disabled={lockedDraft} onPress={() => void repeatOrEdit(note, false)} />)}
    </Panel> : null}
  </ScrollView>;
}
const styles = StyleSheet.create({ content: { padding: space.lg, paddingBottom: space.xxl * 3, gap: space.lg }, heading: { fontSize: typeScale.title, fontWeight: "700" }, fields: { gap: space.sm }, row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm }, note: { borderTopWidth: 1, paddingTop: space.md, marginTop: space.md, gap: space.sm } });
