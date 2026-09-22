"use client";

import { useCallback, useEffect, useState, type DragEvent } from "react";
import Link from "next/link";
import {
  MEAL_SLOTS,
  MEAL_SLOT_LABEL,
  dayLabel,
  groupByDay,
  recipeIdsIn,
  shiftWeeks,
  todayISO,
  weekLabel,
  type LibraryRecipe,
  type MealSlot,
  type PlannedMeal,
  type PlanSuggestion,
} from "@seconds/core/format";
import { api } from "@/lib/client";
import { actionFailure, signInReturnHref, type ActionFailure } from "@/lib/action-failure";
import { Button, Callout, Panel, PanelHeader } from "@/ui";
import { AddMealDialog } from "./AddMealDialog";
import { PlanTogether } from "./PlanTogether";
import styles from "./plan.module.css";

/**
 * A week of meals.
 *
 * The grid shows every day and every slot, empty ones included — an empty
 * Thursday is exactly the thing a plan is for, and hiding it would defeat the
 * point of looking at the week at all.
 */
export function PlanWeek({ initialWeek }: { initialWeek: string }) {
  const [week, setWeek] = useState(initialWeek);
  const [meals, setMeals] = useState<PlannedMeal[]>([]);
  const [library, setLibrary] = useState<LibraryRecipe[]>([]);
  const [adding, setAdding] = useState<{ date: string; slot: MealSlot } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ActionFailure | null>(null);
  const [sentToList, setSentToList] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<{ date: string; slot: MealSlot } | null>(null);
  const [suggestions, setSuggestions] = useState<PlanSuggestion[]>([]);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [recentlyRemoved, setRecentlyRemoved] = useState<PlannedMeal | null>(null);
  const [planStatus, setPlanStatus] = useState("");

  const today = todayISO();

  const load = useCallback(async (forWeek: string) => {
    setError(null);
    try {
      const data = await api.plan(forWeek);
      setMeals(data.meals);
    } catch (err) {
      setError(actionFailure(err, "Couldn't load your plan."));
    }
  }, []);

  useEffect(() => {
    setConfirmingClear(false);
    setRecentlyRemoved(null);
    setPlanStatus("");
    void load(week);
  }, [load, week]);

  // The picker needs something to pick from; fetched once, not per open.
  useEffect(() => {
    void api
      .library()
      .then((data) => setLibrary(data.recipes))
      .catch(() => undefined);
  }, []);

  const loadSuggestions = useCallback(() => {
    void api
      .mySuggestions()
      .then((data) => setSuggestions(data.suggestions))
      .catch(() => undefined);
  }, []);

  useEffect(() => loadSuggestions(), [loadSuggestions]);

  const respond = async (suggestion: PlanSuggestion, action: "accept" | "dismiss") => {
    setRespondingTo(suggestion.id);
    setError(null);
    try {
      await api.respondToSuggestion(suggestion.id, action);
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
      // An accepted suggestion just wrote to whichever week it was planned
      // for, which may not be the one currently on screen — reload either way.
      if (action === "accept") void load(week);
    } catch (err) {
      setError(actionFailure(err, "That didn't work."));
    } finally {
      setRespondingTo(null);
    }
  };

  const run = async (work: () => Promise<{ meals: PlannedMeal[]; addedToList?: number }>) => {
    setBusy(true);
    setError(null);
    try {
      const data = await work();
      setMeals(data.meals);
      if (data.addedToList !== undefined && data.addedToList > 0) setSentToList(data.addedToList);
      return true;
    } catch (err) {
      setError(actionFailure(err, "That didn't work."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const removeMeal = async (meal: PlannedMeal) => {
    setPlanStatus("");
    if (await run(() => api.planRemove(meal.recipeId, meal.date, meal.slot, week))) {
      setRecentlyRemoved(meal);
    }
  };

  const undoRemoval = async () => {
    const meal = recentlyRemoved;
    if (!meal) return;
    if (await run(() => api.planAdd(meal.recipeId, meal.date, meal.slot, week))) {
      setRecentlyRemoved(null);
      setPlanStatus(`${meal.title} is back on ${dayLabel(meal.date)}.`);
    }
  };

  const clearWeek = async () => {
    setPlanStatus("");
    if (await run(() => api.planClearWeek(week))) {
      setConfirmingClear(false);
      setRecentlyRemoved(null);
      setPlanStatus("The week is clear.");
    }
  };

  const grid = groupByDay(meals, week);
  const planned = recipeIdsIn(meals).length;

  const dragMeal = (event: DragEvent, recipeId: string, date: string, slot: MealSlot) => {
    event.dataTransfer.setData("text/plain", JSON.stringify({ recipeId, date, slot }));
    event.dataTransfer.effectAllowed = "move";
  };

  const dropMeal = (event: DragEvent, date: string, slot: MealSlot) => {
    event.preventDefault();
    setDragOver(null);
    let from: { recipeId: string; date: string; slot: MealSlot };
    try {
      from = JSON.parse(event.dataTransfer.getData("text/plain"));
    } catch {
      return;
    }
    // Dropping a meal back on the slot it came from is a no-op, not a request.
    if (from.date === date && from.slot === slot) return;
    void run(() => api.planMove(from.recipeId, { date: from.date, slot: from.slot }, { date, slot }, week));
  };

  return (
    <>
      {week === shiftWeeks(today, 0) ? <PlanTogether date={today} week={week} onPlanned={setMeals} /> : null}
      <Panel>
        <PanelHeader
          title="The week"
          hint="What you're cooking, and when. Everything planned here can become one shopping list."
        />

        <div className={styles.weekBar}>
          <Button type="button" variant="ghost" onClick={() => setWeek(shiftWeeks(week, -1))}>
            ← Previous
          </Button>
          <strong className={styles.weekLabel}>{weekLabel(week)}</strong>
          <Button type="button" variant="ghost" onClick={() => setWeek(shiftWeeks(week, 1))}>
            Next →
          </Button>
          <Button type="button" variant="ghost" onClick={() => setWeek(shiftWeeks(todayISO(), 0))}>
            This week
          </Button>
        </div>

        <div className={styles.weekActions}>
          <Button
            type="button"
            disabled={busy || planned === 0}
            onClick={() => void run(() => api.planToShoppingList(week))}
          >
            Add this week to the shopping list
          </Button>
          {planned > 0 ? (
            <>
              <button
                type="button"
                className={styles.clearWeek}
                disabled={busy}
                aria-expanded={confirmingClear}
                onClick={() => {
                  setPlanStatus("");
                  setConfirmingClear(true);
                }}
              >
                Clear the week
              </button>
              {confirmingClear ? (
                <div className={styles.clearConfirm} role="group" aria-label="Confirm clearing meal plan">
                  <span>Remove every planned meal from {weekLabel(week)}?</span>
                  <Button type="button" variant="danger" disabled={busy} onClick={() => void clearWeek()}>
                    {busy ? "Clearing…" : "Clear every meal"}
                  </Button>
                  <Button type="button" variant="ghost" disabled={busy} onClick={() => setConfirmingClear(false)}>Keep this week</Button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        {sentToList !== null ? (
          <Callout tone="info" role="status">
            {sentToList} {sentToList === 1 ? "recipe" : "recipes"} added — duplicates merged and
            anything already in your pantry left off. <Link href="/list">See the list</Link>.
          </Callout>
        ) : null}

        {recentlyRemoved ? (
          <Callout tone="info" role="status">
            <span>
              Removed {recentlyRemoved.title} from {MEAL_SLOT_LABEL[recentlyRemoved.slot].toLowerCase()} on {dayLabel(recentlyRemoved.date)}.
            </span>{" "}
            <button
              type="button"
              className={styles.undoRemoval}
              disabled={busy}
              autoFocus
              onClick={() => void undoRemoval()}
            >
              {busy ? "Restoring…" : "Undo"}
            </button>
          </Callout>
        ) : planStatus ? (
          <Callout tone="info" role="status">{planStatus}</Callout>
        ) : null}

        {error ? (
          <Callout tone="error" role="alert">
            {error.message}
            {error.signInRequired ? <> <Link href={signInReturnHref(`/plan?week=${week}`)}>Sign in again</Link>.</> : null}
          </Callout>
        ) : null}

        {suggestions.length > 0 ? (
          <div className={styles.suggestions}>
            {suggestions.map((suggestion) => (
              <div key={suggestion.id} className={styles.suggestionRow}>
                <span className={styles.suggestionText}>
                  <strong>{suggestion.suggestedBy.displayName}</strong> suggested{" "}
                  <Link href={`/recipe/${suggestion.recipeId}`}>{suggestion.title}</Link> for{" "}
                  {MEAL_SLOT_LABEL[suggestion.slot]} on {dayLabel(suggestion.date)}
                </span>
                <div className={styles.suggestionActions}>
                  <button
                    type="button"
                    disabled={respondingTo === suggestion.id}
                    onClick={() => void respond(suggestion, "accept")}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={respondingTo === suggestion.id}
                    onClick={() => void respond(suggestion, "dismiss")}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </Panel>

      <div className={styles.week}>
        {grid.map((day) => (
          <section
            key={day.date}
            className={styles.day}
            data-today={day.date === today}
            aria-label={dayLabel(day.date)}
          >
            <h3 className={styles.dayHeading}>
              {dayLabel(day.date)}
              {day.date === today ? <span className={styles.todayMark}>Today</span> : null}
            </h3>

            {day.slots.map(({ slot, meals: inSlot }) => (
              <div
                key={slot}
                className={styles.slot}
                data-drag-over={
                  dragOver?.date === day.date && dragOver?.slot === slot ? true : undefined
                }
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver({ date: day.date, slot });
                }}
                onDragLeave={() =>
                  setDragOver((prev) =>
                    prev?.date === day.date && prev?.slot === slot ? null : prev,
                  )
                }
                onDrop={(e) => dropMeal(e, day.date, slot)}
              >
                <span className={styles.slotLabel}>{MEAL_SLOT_LABEL[slot]}</span>

                {inSlot.map((planned) => (
                  <div
                    key={planned.recipeId}
                    className={styles.meal}
                    draggable={!busy}
                    onDragStart={(e) => dragMeal(e, planned.recipeId, day.date, slot)}
                  >
                    <Link className={styles.mealTitle} href={`/recipe/${planned.recipeId}`}>
                      {planned.title}
                    </Link>
                    <button
                      type="button"
                      className={styles.removeMeal}
                      disabled={busy}
                      aria-label={`Remove ${planned.title} from ${dayLabel(day.date)}`}
                      onClick={() => void removeMeal(planned)}
                    >
                      ×
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  className={styles.addMeal}
                  disabled={busy}
                  aria-label={`Add a recipe to ${MEAL_SLOT_LABEL[slot]} on ${dayLabel(day.date)}`}
                  onClick={() => setAdding({ date: day.date, slot })}
                >
                  +
                </button>
              </div>
            ))}
          </section>
        ))}
      </div>

      {adding ? (
        <AddMealDialog
          date={adding.date}
          slot={adding.slot}
          recipes={library}
          onClose={() => setAdding(null)}
          onPick={(recipeId) => {
            setAdding(null);
            void run(() => api.planAdd(recipeId, adding.date, adding.slot, week));
          }}
        />
      ) : null}
    </>
  );
}

export { MEAL_SLOTS };
