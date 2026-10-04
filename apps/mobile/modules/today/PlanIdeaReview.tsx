import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { localFoodDate, MEAL_SLOTS, MEAL_SLOT_LABEL, parseReviewedMeal, weekStart, type MealSlot, type ReviewedMealInput, type SecondsClient } from "@seconds/core/format";
import { Button, Callout, Field, space, type as typeScale, usePalette } from "@/ui";

export function PlanIdeaReview({ recipeId, title, client, onPending }: { recipeId: string; title: string; client: SecondsClient; onPending: (pending: boolean) => void }) {
  const c = usePalette(); const router = useRouter();
  const [expanded, setExpanded] = useState(false); const [date, setDate] = useState(localFoodDate); const [slot, setSlot] = useState<MealSlot | "">("");
  const [pending, setPending] = useState<ReviewedMealInput | null>(null); const [busy, setBusy] = useState(false); const [done, setDone] = useState(false); const [message, setMessage] = useState("");
  const alive = useRef(true); const focused = useRef(true); const visit = useRef(0); const action = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useFocusEffect(useCallback(() => { focused.current = true; action.current = false; setBusy(false); return () => { focused.current = false; ++visit.current; }; }, []));
  const save = async () => {
    if (action.current || done) return;
    let exact: ReviewedMealInput;
    try { exact = pending ?? parseReviewedMeal({ recipeId, date, slot }); }
    catch { setMessage("Choose a valid date and meal slot before adding this recipe."); return; }
    const version = visit.current; action.current = true; setBusy(true); setPending(exact); onPending(true); setMessage("");
    try {
      const result = await client.reviewedPlanAdd(exact);
      if (!result.meals.some(meal => meal.recipeId === exact.recipeId && meal.date === exact.date && meal.slot === exact.slot)) throw new Error("Unconfirmed");
      if (alive.current && focused.current && visit.current === version) { setDone(true); setPending(null); onPending(false); setMessage(`${title} is planned for ${exact.date}, ${MEAL_SLOT_LABEL[exact.slot]}. Existing meals were kept. Pantry, food notes and shopping list were not changed.`); }
    } catch { if (alive.current && focused.current && visit.current === version) setMessage("We could not confirm the meal. It may already be planned. Keep this exact selection for retry, or check your plan."); }
    finally { if (alive.current && focused.current && visit.current === version) { action.current = false; setBusy(false); } }
  };
  const openPlan = () => {
    try { const input = parseReviewedMeal({ recipeId, date, slot: slot || "dinner" }); router.push({ pathname: "/(protected)/(tabs)/plan", params: { week: weekStart(input.date) } }); }
    catch { router.push("/(protected)/(tabs)/plan"); }
  };
  const text = { color: c.textMuted, fontSize: typeScale.body, lineHeight: 23 };
  return <View style={{ gap: space.sm }}><Button label={expanded ? "Hide meal review" : `Choose a day and meal for ${title}`} variant="ghost" onPress={() => setExpanded(value => !value)} />
    {expanded ? <><Text style={text}>Adds a meal alongside existing meals. Planning is not a record of eating and does not consume ingredients.</Text>
      <Field label="Date (YYYY-MM-DD)" value={date} editable={!busy && !pending && !done} onChangeText={setDate} autoCapitalize="none" />
      <Text style={text}>Choose a meal slot</Text><View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>{MEAL_SLOTS.map(value => <Button key={value} label={MEAL_SLOT_LABEL[value]} variant="toggle" selected={slot === value} disabled={busy || pending !== null || done} onPress={() => setSlot(value)} />)}</View>
      <Button label={busy ? "Adding meal…" : pending ? "Retry this exact meal" : "Add this meal to my plan"} disabled={busy || done || !date || !slot} onPress={() => void save()} />
      <Button label="Check this week in my plan" variant="ghost" onPress={openPlan} />
      {pending ? <><Text style={text}>This selection is unconfirmed. Changing ideas is paused. Leaving Today may lose local retry state; check your plan when you return.</Text><Button label="Discard local retry state" variant="ghost" disabled={busy} onPress={() => Alert.alert("Discard local retry state?", "The meal may already be planned. This will not remove it.", [{ text: "Keep selection", style: "cancel" }, { text: "Discard", onPress: () => { if (alive.current && focused.current) { setPending(null); onPending(false); setMessage("Local retry state discarded. Check your plan before choosing another date or slot."); } } }])} /></> : null}
      {message ? <Callout tone={done ? "info" : "error"}>{message}</Callout> : null}
    </> : null}
  </View>;
}
