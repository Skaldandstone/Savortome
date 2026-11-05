"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { localFoodDate, MEAL_SLOTS, MEAL_SLOT_LABEL, parseReviewedMeal, weekStart, type MealSlot, type ReviewedMealInput, type SecondsClient } from "@seconds/core/format";
import { Button, Callout, FieldRow } from "@/ui";

export function PlanIdeaReview({ recipeId, title, client, onPending }: { recipeId: string; title: string; client: SecondsClient; onPending: (pending: boolean) => void }) {
  const [date, setDate] = useState(localFoodDate); const [slot, setSlot] = useState<MealSlot | "">("");
  const [pending, setPending] = useState<ReviewedMealInput | null>(null);
  const [busy, setBusy] = useState(false); const [done, setDone] = useState(false); const [message, setMessage] = useState("");
  const alive = useRef(true); const action = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const save = async () => {
    if (!alive.current || action.current || done) return;
    let exact: ReviewedMealInput;
    try { exact = pending ?? parseReviewedMeal({ recipeId, date, slot }); }
    catch { setMessage("Choose a valid date and meal slot before adding this recipe."); return; }
    action.current = true; setBusy(true); setPending(exact); onPending(true); setMessage("");
    try {
      const result = await client.reviewedPlanAdd(exact);
      if (!result.meals.some(meal => meal.recipeId === exact.recipeId && meal.date === exact.date && meal.slot === exact.slot)) throw new Error("Unconfirmed");
      if (alive.current) { setDone(true); setPending(null); onPending(false); setMessage(`${title} is planned for ${exact.date}, ${MEAL_SLOT_LABEL[exact.slot]}. Existing meals were kept. No food note, shopping list or pantry entry was changed.`); }
    } catch { if (alive.current) setMessage("We could not confirm the meal. It may already be planned. Keep this exact selection for retry, or check your plan."); }
    finally { if (alive.current) { action.current = false; setBusy(false); } }
  };
  let planHref = "/plan";
  try { planHref = `/plan?week=${weekStart(parseReviewedMeal({ recipeId, date, slot: slot || "dinner" }).date)}`; } catch { /* Invalid input never changes the destination. */ }
  return <details><summary>Choose a day and meal for {title}</summary>
    <p>This adds a meal alongside any existing meals. Planning is not a record of eating, and does not consume ingredients.</p>
    <fieldset disabled={busy || pending !== null || done}><legend>Review this meal</legend>
      <label>Date<input type="date" min="2000-01-01" max="2100-12-31" value={date} onChange={event => setDate(event.target.value)} /></label>
      <label>Meal slot<select value={slot} onChange={event => setSlot(event.target.value as MealSlot | "")}><option value="">Choose a meal</option>{MEAL_SLOTS.map(value => <option key={value} value={value}>{MEAL_SLOT_LABEL[value]}</option>)}</select></label>
    </fieldset>
    <FieldRow><Button disabled={busy || done || !date || !slot} onClick={() => void save()}>{busy ? "Adding meal…" : pending ? "Retry this exact meal" : "Add this meal to my plan"}</Button><Link href={planHref}>Check this week in my plan</Link></FieldRow>
    {pending ? <><p>This selection is unconfirmed. Changing ideas is paused. Leaving Today loses the local retry state; check your plan when you return.</p><Button variant="ghost" disabled={busy} onClick={() => { if (window.confirm("Discard local retry state? The meal may already be planned. This will not remove it.")) { setPending(null); onPending(false); setMessage("Local retry state discarded. Check your plan before choosing another date or slot."); } }}>Discard local retry state</Button></> : null}
    {message ? <Callout tone={done ? "info" : "error"} role="status">{message}</Callout> : null}
  </details>;
}
