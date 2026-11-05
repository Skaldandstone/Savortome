import { useCallback, useRef, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { isUuid, localFoodDate, MEAL_SLOTS, MEAL_SLOT_LABEL, parseReviewedTemplatePlan, reviewedTemplatePlanMatches, weekStart, type MealSlot, type MealTemplate, type ReviewedTemplatePlanInput, type SecondsClient } from "@seconds/core/format";
import { Button, Callout, Field, space, type as typeScale, usePalette } from "@/ui";

export function CombinationPlanReview({ meal, client, disabled, onPending }: {
  meal: MealTemplate; client: SecondsClient; disabled: boolean; onPending: (pending: boolean) => void;
}) {
  const c = usePalette(); const router = useRouter();
  const [expanded, setExpanded] = useState(false); const [date, setDate] = useState(localFoodDate); const [slot, setSlot] = useState<MealSlot | "">("");
  const [pending, setPending] = useState<ReviewedTemplatePlanInput | null>(null); const pendingRef = useRef<ReviewedTemplatePlanInput | null>(null);
  const [busy, setBusy] = useState(false); const [done, setDone] = useState(false); const [message, setMessage] = useState("");
  const focused = useRef(false); const visit = useRef(0); const action = useRef(false);
  useFocusEffect(useCallback(() => {
    focused.current = true; ++visit.current; action.current = false; setBusy(false);
    return () => { focused.current = false; ++visit.current; if (pendingRef.current) setMessage("This combination is unconfirmed and may already be planned. Check your plan or retry the same selection."); };
  }, []));
  const current = (version: number) => focused.current && visit.current === version;
  const dishes = [...new Map(meal.items.map(item => [item.recipeId, item])).values()];
  const eligible = dishes.length > 0 && dishes.length <= 4 && dishes.every(dish => isUuid(dish.recipeId));
  const save = async () => {
    if (!focused.current || action.current || done || (disabled && !pending)) return;
    let exact: ReviewedTemplatePlanInput;
    try { exact = pending ?? parseReviewedTemplatePlan({ templateId: meal.id, recipeIds: dishes.map(dish => dish.recipeId), date, slot }); }
    catch { setMessage("Review the dishes, a valid date and breakfast, lunch or dinner first."); return; }
    const version = ++visit.current; action.current = true; setBusy(true); pendingRef.current = exact; setPending(exact); onPending(true); setMessage("");
    try {
      const result = await client.reviewedTemplatePlanAdd(exact);
      if (!reviewedTemplatePlanMatches(exact, result.confirmed)) throw new Error("Unconfirmed");
      if (current(version)) { pendingRef.current = null; setPending(null); setDone(true); onPending(false); setMessage(`${exact.recipeIds.length} distinct ${exact.recipeIds.length === 1 ? "dish" : "dishes"} planned for ${exact.date}, ${MEAL_SLOT_LABEL[exact.slot]}. Existing meals stayed. No food note, shopping or pantry change.`); }
    } catch { if (current(version)) setMessage("We could not confirm this combination. It may already be planned. Retry these exact dishes, date and slot, or check your plan. Changed saved dishes need a fresh review after this local request is resolved or discarded."); }
    finally { if (current(version)) { action.current = false; setBusy(false); } }
  };
  const openPlan = () => {
    try { const exact = parseReviewedTemplatePlan(pending ?? { templateId: meal.id, recipeIds: dishes.map(dish => dish.recipeId), date, slot: slot || "dinner" }); router.push({ pathname: "/(protected)/(tabs)/plan", params: { week: weekStart(exact.date) } }); }
    catch { router.push("/(protected)/(tabs)/plan"); }
  };
  const text = { color: c.textMuted, fontSize: typeScale.body, lineHeight: 23 };
  return <View style={{ gap: space.sm }}><Button label={expanded ? "Hide combination review" : `Choose a day and meal for ${meal.name}`} variant="ghost" onPress={() => setExpanded(value => !value)} />
    {expanded ? <><Text style={text}>Adds every distinct dish once to one slot alongside existing meals. Your calendar stores individual recipes, not grouped roles or extra portions. This does not record eating or consume ingredients.</Text>
      {dishes.map(dish => <Text key={dish.recipeId} style={text}>{dish.title}</Text>)}
      {!eligible ? <Text style={text}>This combination has no usable dishes or needs a fresh review. Reload saved meals before planning.</Text> : null}
      <Text style={text}>Review ingredients and stock first. Saved combinations are not checked here against dietary settings or pantry, and do not verify allergy safety.</Text>
      <Field accessibilityLabel="Combination date, YYYY-MM-DD" value={date} maxLength={10} autoCapitalize="none" editable={!disabled && !busy && !pending && !done} onChangeText={setDate} />
      <Text style={text}>Choose a meal slot</Text><View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>{MEAL_SLOTS.map(value => <Button key={value} label={MEAL_SLOT_LABEL[value]} variant="toggle" selected={slot === value} disabled={disabled || busy || pending !== null || done} onPress={() => setSlot(value)} />)}</View>
      <Button label={busy ? "Planning combination…" : pending ? "Retry this exact combination" : "Add reviewed dishes to my plan"} busy={busy} disabled={busy || done || (!pending && (disabled || !eligible || !date || !slot))} onPress={() => void save()} />
      <Button label="Check this week in my plan" variant="ghost" onPress={openPlan} />
      {pending ? <><Text style={text}>Unconfirmed: {pending.recipeIds.length} distinct dishes, {pending.date}, {MEAL_SLOT_LABEL[pending.slot]}. Other saved-meal actions are paused. Leaving Today may lose local retry state while the earlier request still completes.</Text><Button label="Discard local planning request" variant="ghost" disabled={busy} onPress={() => {
        if (!focused.current || action.current || !pendingRef.current) return;
        const version = visit.current;
        Alert.alert("Discard local request?", "The dishes may already be planned. Nothing will be removed. Check your plan before choosing another date or slot.", [{ text: "Keep request", style: "cancel" }, { text: "Discard locally", onPress: () => { if (current(version) && !action.current && pendingRef.current) { pendingRef.current = null; setPending(null); onPending(false); setMessage("Local request discarded. No meal was removed. Review your plan before choosing a new date or slot."); } } }]);
      }} /></> : null}
    </> : null}
    {message ? <Callout tone={done ? "info" : "warn"}>{message}</Callout> : null}
  </View>;
}
