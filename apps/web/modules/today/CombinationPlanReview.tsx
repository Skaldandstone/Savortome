"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { isUuid, localFoodDate, MEAL_SLOTS, MEAL_SLOT_LABEL, parseReviewedTemplatePlan, reviewedTemplatePlanMatches, weekStart, type MealSlot, type MealTemplate, type ReviewedTemplatePlanInput, type SecondsClient } from "@seconds/core/format";
import { Button, Callout, FieldRow } from "@/ui";

export function CombinationPlanReview({ meal, client, disabled, onPending }: {
  meal: MealTemplate; client: SecondsClient; disabled: boolean; onPending: (pending: boolean) => void;
}) {
  const [date, setDate] = useState(localFoodDate); const [slot, setSlot] = useState<MealSlot | "">("");
  const [pending, setPending] = useState<ReviewedTemplatePlanInput | null>(null);
  const [busy, setBusy] = useState(false); const [done, setDone] = useState(false); const [message, setMessage] = useState("");
  const alive = useRef(true); const action = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const dishes = [...new Map(meal.items.map(item => [item.recipeId, item])).values()];
  const eligible = dishes.length > 0 && dishes.length <= 4 && dishes.every(dish => isUuid(dish.recipeId));
  const save = async () => {
    if (action.current || done || (disabled && !pending)) return;
    let exact: ReviewedTemplatePlanInput;
    try { exact = pending ?? parseReviewedTemplatePlan({ templateId: meal.id, recipeIds: dishes.map(dish => dish.recipeId), date, slot }); }
    catch { setMessage("Review the saved dishes, a valid date and breakfast, lunch or dinner before planning."); return; }
    action.current = true; setBusy(true); setPending(exact); onPending(true); setMessage("");
    try {
      const result = await client.reviewedTemplatePlanAdd(exact);
      if (!reviewedTemplatePlanMatches(exact, result.confirmed)) throw new Error("Unconfirmed");
      if (alive.current) { setPending(null); setDone(true); onPending(false); setMessage(`${exact.recipeIds.length} distinct ${exact.recipeIds.length === 1 ? "dish" : "dishes"} planned for ${exact.date}, ${MEAL_SLOT_LABEL[exact.slot]}. Existing meals were kept. No food note, shopping list or pantry entry changed.`); }
    } catch { if (alive.current) setMessage("We could not confirm this combination. It may already be planned. Keep the exact dishes, date and slot for retry, or check your plan. If saved dishes changed, reload only after reviewing or discarding this local request."); }
    finally { if (alive.current) { action.current = false; setBusy(false); } }
  };
  let href = "/plan";
  try { href = `/plan?week=${weekStart(parseReviewedTemplatePlan(pending ?? { templateId: meal.id, recipeIds: dishes.map(dish => dish.recipeId), date, slot: slot || "dinner" }).date)}`; } catch { /* Navigation does not select or save a slot. */ }
  return <details><summary>Choose a day and meal for {meal.name}</summary>
    <p>Review every distinct dish below. Each is added once to the same slot alongside existing meals. This stores individual recipes, not a grouped meal or extra portions. Planning does not record eating or consume ingredients.</p>
    <ul>{dishes.map(dish => <li key={dish.recipeId}>{dish.title}</li>)}</ul>
    {!eligible ? <p>This combination has no usable dishes or needs a fresh review. Reload saved meals before planning it.</p> : null}
    <p>Saved combinations are not rechecked here against your dietary profile or pantry, and do not verify allergy safety. Review ingredients and actual stock first.</p>
    <fieldset disabled={disabled || busy || pending !== null || done}><legend>Review combination date and meal</legend>
      <label>Date<input type="date" min="2000-01-01" max="2100-12-31" value={date} onChange={event => setDate(event.target.value)} /></label>
      <label>Meal slot<select value={slot} onChange={event => setSlot(event.target.value as MealSlot | "")}><option value="">Choose a meal</option>{MEAL_SLOTS.map(value => <option key={value} value={value}>{MEAL_SLOT_LABEL[value]}</option>)}</select></label>
    </fieldset>
    <FieldRow><Button disabled={busy || done || (!pending && (disabled || !eligible || !date || !slot))} onClick={() => void save()}>{busy ? "Planning combination…" : pending ? "Retry this exact combination" : "Add reviewed dishes to my plan"}</Button><Link href={href}>Check this week in my plan</Link></FieldRow>
    {pending ? <><p>Unconfirmed: {pending.recipeIds.length} distinct dishes, {pending.date}, {MEAL_SLOT_LABEL[pending.slot]}. Other saved-meal choices are paused. Leaving Today loses local retry state; the earlier write may still complete.</p><Button variant="ghost" disabled={busy} onClick={() => {
      if (action.current || !window.confirm("Discard only this local planning request? It may already be planned. This does not remove any meal. Check your plan before choosing another date or slot.")) return;
      setPending(null); onPending(false); setMessage("Local request discarded. Nothing was removed from your plan. Review your plan before choosing another date or slot.");
    }}>Discard local planning request</Button></> : null}
    {message ? <Callout tone={done ? "info" : "warn"} role="status">{message}</Callout> : null}
  </details>;
}
