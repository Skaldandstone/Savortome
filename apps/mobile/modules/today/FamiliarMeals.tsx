import { useCallback, useRef, useState } from "react";
import { Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { orderedTemplateItems, templateFoodNoteName, TEMPLATE_ROLE_LABEL, type MealTemplate, type SecondsClient } from "@seconds/core/format";
import { Button, Callout, Panel, PanelHeader, space, type as typeScale, usePalette } from "@/ui";

export function FamiliarMeals({ client, disabled, onDraft }: {
  client: SecondsClient; disabled: boolean; onDraft: (title: string) => boolean | Promise<boolean>;
}) {
  const c = usePalette(); const router = useRouter();
  const [expanded, setExpanded] = useState(false); const [shown, setShown] = useState(6);
  const [meals, setMeals] = useState<MealTemplate[] | null>(null);
  const [busy, setBusy] = useState(false); const [failed, setFailed] = useState(false);
  const [preparing, setPreparing] = useState(false); const [message, setMessage] = useState("");
  const focused = useRef(false); const sequence = useRef(0); const action = useRef(false);
  useFocusEffect(useCallback(() => {
    focused.current = true; ++sequence.current; action.current = false;
    setBusy(false); setPreparing(false); setMeals(null); setFailed(false); setMessage(""); setShown(6);
    return () => { focused.current = false; ++sequence.current; };
  }, []));
  const current = (version: number) => focused.current && sequence.current === version;
  const load = async () => {
    if (action.current || disabled || !focused.current) return;
    action.current = true; const read = ++sequence.current;
    setBusy(true); setFailed(false); setMeals(null); setShown(6); setMessage("");
    try { const result = await client.myTemplates(); if (current(read)) setMeals(result.templates); }
    catch { if (current(read)) setFailed(true); }
    finally { if (current(read)) { action.current = false; setBusy(false); } }
  };
  const draft = async (meal: MealTemplate) => {
    const title = templateFoodNoteName(meal.name);
    if (!title || action.current || disabled || !focused.current) return;
    action.current = true; const version = sequence.current; setPreparing(true); setMessage("");
    try { if (await onDraft(title) && current(version)) setMessage("Meal name copied to the optional food note below. Review its date and portion, then save only if you want a record. Nothing has been saved."); }
    catch { if (current(version)) setMessage("The draft could not open. Your saved meal has not changed."); }
    finally { if (current(version)) { action.current = false; setPreparing(false); } }
  };
  const textStyle = { color: c.textMuted, fontSize: typeScale.body, lineHeight: 23 };
  return <Panel><PanelHeader title="A meal you already saved" hint="Something familiar can be enough. These are saved combinations, not recommendations based on current dietary settings or pantry stock." />
    <Button label={expanded ? "Hide saved meals" : "Browse my saved meals"} variant="ghost" onPress={() => setExpanded(value => !value)} />
    {expanded ? <View style={{ gap: space.sm }}>
      <Text style={textStyle}>Open a dish to review its ingredients and steps. These meals are not checked here for allergen conflicts or changes in your dietary profile; they do not verify allergy safety.</Text>
      <Button label={busy ? "Loading saved meals…" : meals !== null ? "Refresh saved meals" : "Load my saved meals"} variant="ghost" disabled={disabled || busy || preparing} onPress={() => void load()} />
      {busy ? <Text accessibilityLiveRegion="polite" style={textStyle}>Loading your combinations…</Text> : null}
      {failed ? <Callout tone="error">Saved meals could not load. Try again before deciding this list is empty.</Callout> : null}
      {meals?.length === 0 ? <Text style={textStyle}>No saved combinations yet. Open a saved recipe and choose Keep a familiar meal, or use the web recipe's companion-dishes section. Then reload here.</Text> : null}
      {meals ? meals.slice(0, shown).map(meal => <View key={meal.id} style={{ borderTopWidth: 1, borderColor: c.border, paddingTop: space.sm, gap: space.sm }}>
        <Text accessibilityRole="header" style={{ color: c.text, fontSize: typeScale.title }}>{meal.name}</Text>
        {meal.items.length ? orderedTemplateItems(meal.items).map((item, index) => <Button key={`${item.role}:${item.recipeId}:${index}`} label={`${TEMPLATE_ROLE_LABEL[item.role]}: ${item.title}`} variant="ghost" disabled={disabled || preparing} onPress={() => router.push({ pathname: "/recipe/[id]", params: { id: item.recipeId } })} />) : <Text style={textStyle}>No dishes remain in this combination. You can still review its name.</Text>}
        <Button label={`Use ${meal.name} as a food-note draft`} variant="ghost" disabled={disabled || busy || preparing || !templateFoodNoteName(meal.name)} onPress={() => void draft(meal)} />
        {!templateFoodNoteName(meal.name) ? <Text style={textStyle}>This name is too long or cannot be copied. Enter a short food name below instead; nothing is truncated.</Text> : null}
      </View>) : null}
      {meals && meals.length > shown ? <Button label="Show more saved meals" variant="ghost" disabled={disabled || busy || preparing} onPress={() => setShown(value => value + 6)} /> : null}
      <Text style={textStyle}>Copying a name does not record eating, add to your plan, change inventory or infer a portion.</Text>
    </View> : null}
    {message ? <Callout tone="info">{message}</Callout> : null}
  </Panel>;
}
