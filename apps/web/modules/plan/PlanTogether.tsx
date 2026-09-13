"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ALLERGEN_DISCLAIMER,
  MEAL_SLOTS,
  MEAL_SLOT_LABEL,
  type MealSlot,
  type PlannedMeal,
  type PlanTogetherIdea,
} from "@seconds/core/format";
import { api } from "@/lib/client";
import { Button, Callout } from "@/ui";
import styles from "./plan.module.css";

export function PlanTogether({ date, week, onPlanned }: {
  date: string;
  week: string;
  onPlanned: (meals: PlannedMeal[]) => void;
}) {
  const request = useRef(0);
  const [ideas, setIdeas] = useState<PlanTogetherIdea[]>([]);
  const [pantryCount, setPantryCount] = useState(0);
  const [slots, setSlots] = useState<Record<string, MealSlot>>({});
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [planning, setPlanning] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);

  const load = useCallback(async () => {
    const version = ++request.current;
    setState("loading");
    setMessage("");
    try {
      const result = await api.planTogether();
      if (version !== request.current) return;
      setIdeas(result.ideas);
      setPantryCount(result.pantryCount);
      setState("ready");
    } catch {
      if (version !== request.current) return;
      setState("failed");
    }
  }, []);

  useEffect(() => {
    void load();
    return () => { request.current += 1; };
  }, [load]);

  async function add(idea: PlanTogetherIdea) {
    setPlanning(idea.recipeId);
    setMessage("");
    setMessageIsError(false);
    try {
      const result = await api.planAdd(idea.recipeId, date, slots[idea.recipeId] ?? "dinner", week);
      onPlanned(result.meals);
      setMessage(`${idea.title} is on today's plan.`);
    } catch (error) {
      setMessageIsError(true);
      setMessage(error instanceof Error ? error.message : "That recipe was not added. Try again.");
    } finally {
      setPlanning(null);
    }
  }

  return (
    <section className={styles.together} aria-labelledby="plan-together-heading" aria-busy={state === "loading"}>
      <div className={styles.togetherHeading}>
        <div>
          <p className={styles.eyebrow}>A gentle place to start</p>
          <h2 id="plan-together-heading">Want to plan something together?</h2>
          <p>These ideas use what your pantry currently says you have, including close matches that need a few things.</p>
        </div>
        {state === "failed" ? <Button type="button" variant="ghost" onClick={() => void load()}>Try again</Button> : null}
      </div>

      {state === "loading" ? <p role="status">Checking your pantry and saved recipes…</p> : null}
      {state === "failed" ? <Callout tone="error" role="alert">We could not load your pantry and dietary settings. Nothing was suggested without them.</Callout> : null}
      {state === "ready" && ideas.length === 0 ? (
        <p>{pantryCount === 0 ? "Add a few pantry items or save a recipe, then come back for ideas." : "No suitable saved recipes matched the information available."}</p>
      ) : null}

      {ideas.length > 0 ? (
        <div className={styles.togetherGrid}>
          {ideas.map(idea => (
            <article className={styles.togetherCard} key={idea.recipeId}>
              <div>
                <h3><Link href={`/recipe/${idea.recipeId}`}>{idea.title}</Link></h3>
                <p>{idea.reason}</p>
                {idea.totalMinutes ? <p className={styles.togetherMeta}>About {idea.totalMinutes} minutes</p> : null}
              </div>
              <div className={styles.togetherAction}>
                <label>
                  <span>Meal</span>
                  <select value={slots[idea.recipeId] ?? "dinner"} onChange={event => setSlots(current => ({ ...current, [idea.recipeId]: event.target.value as MealSlot }))}>
                    {MEAL_SLOTS.map(slot => <option value={slot} key={slot}>{MEAL_SLOT_LABEL[slot]}</option>)}
                  </select>
                </label>
                <Button type="button" disabled={planning !== null} onClick={() => void add(idea)}>
                  {planning === idea.recipeId ? "Adding…" : "Plan for today"}
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {state === "ready" ? <p className={styles.togetherBoundary}>Pantry quantities may be out of date. {ALLERGEN_DISCLAIMER}</p> : null}
      {message ? <p role={messageIsError ? "alert" : "status"} className={styles.togetherStatus}>{message}</p> : null}
    </section>
  );
}
