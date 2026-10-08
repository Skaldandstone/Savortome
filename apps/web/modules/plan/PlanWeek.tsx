"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import {
  MEAL_SLOTS,
  MEAL_SLOT_LABEL,
  dayLabel,
  groupByDay,
  recipeIdsIn,
  shiftWeeks,
  todayISO,
  weekLabel,
  weekStart,
  createClient,
  parseReviewedMeal,
  type LibraryRecipe,
  type MealSlot,
  type PlannedMeal,
  type PlanSuggestion,
} from "@seconds/core/format";
import { actionFailure, signInReturnHref, type ActionFailure } from "@/lib/action-failure";
import { Button, Callout, Panel, PanelHeader } from "@/ui";
import { AddMealDialog } from "./AddMealDialog";
import styles from "./plan.module.css";

/**
 * A week of meals.
 *
 * The grid shows every day and every slot, empty ones included — an empty
 * Thursday is exactly the thing a plan is for, and hiding it would defeat the
 * point of looking at the week at all.
 */
export function PlanWeek({ initialWeek, clerkEnabled = true }: { initialWeek: string; clerkEnabled?: boolean }) {
  return clerkEnabled ? <AuthenticatedPlanWeek initialWeek={initialWeek} /> : <AccountPlanWeek initialWeek={initialWeek} />;
}
function AuthenticatedPlanWeek({ initialWeek }: { initialWeek: string }) {
  const { isLoaded, userId, sessionId } = useAuth();
  if (!isLoaded) return <p role="status">Loading your sign-in…</p>;
  if (!userId || !sessionId) return <Callout tone="info"><Link href={signInReturnHref(`/plan?week=${initialWeek}`)}>Sign in again to load your meal plan.</Link></Callout>;
  return <AccountPlanWeek key={`${sessionId}:${initialWeek}`} initialWeek={initialWeek} sessionId={sessionId} />;
}
function AccountPlanWeek({ initialWeek, sessionId }: { initialWeek: string; sessionId?: string }) {
  const api = useMemo(() => createClient({ expectedSessionId: sessionId }), [sessionId]);
  const alive = useRef(true); const mutation = useRef(false); const planRead = useRef(0);
  const suggestionRead = useRef(0); const currentWeek = useRef(initialWeek);
  const uncertain = useRef(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [reviewReloaded, setReviewReloaded] = useState(false);
  const [needsSuggestionReview, setNeedsSuggestionReview] = useState(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; ++planRead.current; ++suggestionRead.current; }; }, []);
  const [week, setWeek] = useState(initialWeek);
  currentWeek.current = week;
  const [meals, setMeals] = useState<PlannedMeal[]>([]);
  const [library, setLibrary] = useState<LibraryRecipe[]>([]);
  const [adding, setAdding] = useState<{ date: string; slot: MealSlot } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ActionFailure | null>(null);
  const [sentToList, setSentToList] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<{ date: string; slot: MealSlot } | null>(null);
  const [suggestions, setSuggestions] = useState<PlanSuggestion[]>([]);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [recentlyRemoved, setRecentlyRemoved] = useState<PlannedMeal | null>(null);
  const [planStatus, setPlanStatus] = useState("");
  const [loadedWeek, setLoadedWeek] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [planLoadError, setPlanLoadError] = useState<ActionFailure | null>(null);
  const [planAttempt, setPlanAttempt] = useState(0);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [libraryLoadError, setLibraryLoadError] = useState<ActionFailure | null>(null);
  const [libraryAttempt, setLibraryAttempt] = useState(0);
  const loadedWeekRef = useRef<string | null>(null);

  const today = todayISO();
  const currentWeekLoaded = loadedWeek === week;
  const blocked = busy || unconfirmed || !currentWeekLoaded || planLoading || planLoadError !== null;

  useEffect(() => {
    let cancelled = false;
    const version = ++planRead.current;
    setConfirmingClear(false);
    setRecentlyRemoved(null);
    setPlanStatus("");
    setPlanLoading(true);
    setPlanLoadError(null);
    if (loadedWeekRef.current !== week) setMeals([]);
    void api.plan(week).then(data => {
      if (cancelled || !alive.current || planRead.current !== version) return;
      setMeals(data.meals);
      loadedWeekRef.current = week;
      setLoadedWeek(week);
      if (uncertain.current) setReviewReloaded(true);
    }).catch(err => {
      if (!cancelled && alive.current && planRead.current === version) setPlanLoadError(actionFailure(err, "Couldn't load your plan."));
    }).finally(() => {
      if (!cancelled && alive.current && planRead.current === version) setPlanLoading(false);
    });
    return () => { cancelled = true; };
  }, [api, week, planAttempt]);

  // The picker needs something to pick from. Keep a successfully loaded list
  // visible during refreshes, but never describe a failed first load as an
  // honestly empty recipe library.
  useEffect(() => {
    let cancelled = false;
    setLibraryLoading(true);
    setLibraryLoadError(null);
    void api.library().then(data => {
      if (cancelled) return;
      setLibrary(data.recipes);
      setLibraryLoaded(true);
    }).catch(err => {
      if (!cancelled) setLibraryLoadError(actionFailure(err, "Couldn't load your recipes."));
    }).finally(() => {
      if (!cancelled) setLibraryLoading(false);
    });
    return () => { cancelled = true; };
  }, [api, libraryAttempt]);

  const loadSuggestions = useCallback(() => {
    const version = ++suggestionRead.current;
    setSuggestionsLoading(true); setSuggestionsError(false);
    void api
      .mySuggestions()
      .then((data) => { if (alive.current && suggestionRead.current === version) setSuggestions(data.suggestions); })
      .catch(() => { if (alive.current && suggestionRead.current === version) setSuggestionsError(true); })
      .finally(() => { if (alive.current && suggestionRead.current === version) setSuggestionsLoading(false); });
  }, [api]);

  useEffect(() => loadSuggestions(), [loadSuggestions]);

  const respond = async (suggestion: PlanSuggestion, action: "accept" | "dismiss") => {
    if (mutation.current || blocked || suggestionsLoading || suggestionsError) return;
    mutation.current = true; uncertain.current = true; setUnconfirmed(true); setReviewReloaded(false); setNeedsSuggestionReview(true); setBusy(true);
    ++suggestionRead.current; ++planRead.current;
    setRespondingTo(suggestion.id);
    setError(null);
    try {
      const result = await api.respondToSuggestion(suggestion.id, action);
      if (!result.ok) throw new Error("Unconfirmed");
      if (!alive.current) return;
      uncertain.current = false; setUnconfirmed(false);
      setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id));
      // An accepted suggestion just wrote to whichever week it was planned
      // for, which may not be the one currently on screen — reload either way.
      if (action === "accept") setPlanAttempt(current => current + 1);
    } catch (err) {
      if (alive.current) setError(actionFailure(err, "We could not confirm that response. Reload your plan and suggestions before trying again."));
    } finally {
      if (alive.current) { mutation.current = false; setBusy(false); setRespondingTo(null); }
    }
  };

  const run = async (work: () => Promise<{ meals: PlannedMeal[]; addedToList?: number }>) => {
    if (mutation.current || blocked) return false;
    mutation.current = true; uncertain.current = true; setUnconfirmed(true); setReviewReloaded(false); setNeedsSuggestionReview(false);
    const selectedWeek = week; ++planRead.current;
    setBusy(true);
    setError(null);
    try {
      const data = await work();
      if (!alive.current || currentWeek.current !== selectedWeek) return false;
      setMeals(data.meals);
      loadedWeekRef.current = selectedWeek; setLoadedWeek(selectedWeek);
      uncertain.current = false; setUnconfirmed(false);
      if (data.addedToList !== undefined && data.addedToList > 0) setSentToList(data.addedToList);
      return true;
    } catch (err) {
      if (alive.current) setError(actionFailure(err, "We could not confirm that change. It may already have saved. Reload and review before another change."));
      return false;
    } finally {
      if (alive.current) { mutation.current = false; setBusy(false); }
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
    if (await run(() => api.reviewedPlanAdd({ recipeId: meal.recipeId, date: meal.date, slot: meal.slot }))) {
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
  const chooseWeek = (next: string) => {
    if (mutation.current || uncertain.current) return;
    setAdding(null); setSentToList(null); setWeek(next);
  };

  const dragMeal = (event: DragEvent, recipeId: string, date: string, slot: MealSlot) => {
    event.dataTransfer.setData("text/plain", JSON.stringify({ recipeId, date, slot }));
    event.dataTransfer.effectAllowed = "move";
  };

  const dropMeal = (event: DragEvent, date: string, slot: MealSlot) => {
    event.preventDefault();
    setDragOver(null);
    if (blocked || mutation.current) return;
    let from: { recipeId: string; date: string; slot: MealSlot };
    try {
      const payload = event.dataTransfer.getData("text/plain");
      if (payload.length > 1024) return;
      from = JSON.parse(payload);
      from = parseReviewedMeal(from);
      if (!meals.some(meal => meal.recipeId === from.recipeId && meal.date === from.date && meal.slot === from.slot)) return;
    } catch {
      return;
    }
    // Dropping a meal back on the slot it came from is a no-op, not a request.
    if (from.date === date && from.slot === slot) return;
    void run(() => api.planMove(from.recipeId, { date: from.date, slot: from.slot }, { date, slot }, week));
  };

  return (
    <>
      <Callout tone="info"><Link href="/today">Plan something together in Today</Link>. Keep a chosen recipe while reviewing its day, meal slot and missing shopping items.</Callout>
      <Panel>
        <PanelHeader
          title="The week"
          hint="What you're cooking, and when. Everything planned here can become one shopping list."
        />

        <div className={styles.weekBar}>
          <Button type="button" variant="ghost" disabled={busy || unconfirmed} onClick={() => chooseWeek(shiftWeeks(week, -1))}>
            ← Previous
          </Button>
          <strong className={styles.weekLabel}>{weekLabel(week)}</strong>
          <Button type="button" variant="ghost" disabled={busy || unconfirmed} onClick={() => chooseWeek(shiftWeeks(week, 1))}>
            Next →
          </Button>
          <Button type="button" variant="ghost" disabled={busy || unconfirmed} onClick={() => chooseWeek(weekStart(todayISO()))}>
            This week
          </Button>
        </div>

        <div className={styles.weekActions}>
          <Button
            type="button"
            disabled={blocked || planned === 0}
            onClick={() => void run(() => api.planToShoppingList(week))}
          >
            Add this week to the shopping list
          </Button>
          {planned > 0 ? (
            <>
              <button
                type="button"
                className={styles.clearWeek}
                disabled={blocked}
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
                  <Button type="button" variant="danger" disabled={blocked} onClick={() => void clearWeek()}>
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
              disabled={blocked}
              autoFocus
              onClick={() => void undoRemoval()}
            >
              {busy ? "Restoring…" : "Undo"}
            </button>
          </Callout>
        ) : planStatus ? (
          <Callout tone="info" role="status">{planStatus}</Callout>
        ) : null}

        {planLoading ? (
          <p className={styles.loading} role="status">Loading this week… Editing is paused.</p>
        ) : null}

        {planLoadError ? (
          <Callout tone="error" role="alert">
            {currentWeekLoaded
              ? "This week could not refresh. The last plan we loaded remains available below."
              : "This week could not load. Your saved plan has not changed."}{" "}
            <Button type="button" variant="ghost" disabled={planLoading || busy} onClick={() => setPlanAttempt(current => current + 1)}>Try this week again</Button>
          </Callout>
        ) : null}

        {error ? (
          <Callout tone="error" role="alert">
            {error.message}
            {error.signInRequired ? <> <Link href={signInReturnHref(`/plan?week=${week}`)}>Sign in again</Link>.</> : null}
          </Callout>
        ) : null}
        {unconfirmed ? <Callout tone="warn" role="status" title="Check the result before another change">
          <p>A request is pending or unconfirmed and may still finish later. Reloading shows the current plan; it does not prove that a timed-out write never saved. Check the shopping list if you sent meals there. Leaving this page loses this local warning.</p>
          <Button disabled={planLoading || busy} onClick={() => { setReviewReloaded(false); setPlanAttempt(current => current + 1); loadSuggestions(); }}>Reload plan and suggestions to review</Button>{" "}<Link href="/list">Check shopping list</Link>{" "}
          <Button variant="ghost" disabled={!reviewReloaded || planLoading || busy || planLoadError !== null || (needsSuggestionReview && (suggestionsLoading || suggestionsError))} onClick={() => { uncertain.current = false; setUnconfirmed(false); setError(null); setConfirmingClear(false); setRecentlyRemoved(null); setSentToList(null); setPlanStatus("Review acknowledged. No request was repeated and nothing was undone."); }}>I reviewed the result; allow further changes</Button>
        </Callout> : null}
        {suggestionsLoading ? <p role="status">Loading meal suggestions…</p> : null}
        {suggestionsError ? <Callout tone="error" role="alert">Meal suggestions could not load; this does not mean there are none. <Button variant="ghost" disabled={busy} onClick={loadSuggestions}>Load suggestions again</Button></Callout> : null}

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
                    disabled={blocked || suggestionsLoading || suggestionsError || respondingTo !== null}
                    onClick={() => void respond(suggestion, "accept")}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={blocked || suggestionsLoading || suggestionsError || respondingTo !== null}
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

      {currentWeekLoaded ? <div className={styles.week}>
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
                    draggable={!blocked}
                    onDragStart={(e) => dragMeal(e, planned.recipeId, day.date, slot)}
                  >
                    <Link className={styles.mealTitle} href={`/recipe/${planned.recipeId}`}>
                      {planned.title}
                    </Link>
                    <button
                      type="button"
                      className={styles.removeMeal}
                      disabled={blocked}
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
                  disabled={blocked}
                  aria-label={`Add a recipe to ${MEAL_SLOT_LABEL[slot]} on ${dayLabel(day.date)}`}
                  onClick={() => setAdding({ date: day.date, slot })}
                >
                  +
                </button>
              </div>
            ))}
          </section>
        ))}
      </div> : null}

      {adding ? (
        <AddMealDialog
          date={adding.date}
          slot={adding.slot}
          recipes={library}
          loaded={libraryLoaded}
          disabled={blocked || libraryLoading || libraryLoadError !== null}
          loading={libraryLoading}
          loadError={libraryLoadError?.message ?? null}
          onRetry={() => setLibraryAttempt(current => current + 1)}
          onClose={() => setAdding(null)}
          onPick={(recipeId) => {
            setAdding(null);
            void run(() => api.reviewedPlanAdd({ recipeId, date: adding.date, slot: adding.slot }));
          }}
        />
      ) : null}
    </>
  );
}

export { MEAL_SLOTS };
