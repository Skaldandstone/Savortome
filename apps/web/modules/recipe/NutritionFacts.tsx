"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  NUTRITION_DISCLAIMER,
  nutritionLabel,
  type Recipe,
} from "@seconds/core/format";
import styles from "./NutritionFacts.module.css";

/**
 * The per-serving figures, and the honesty about where they came from.
 *
 * Available on request whenever a recipe has nutrition; offered as something to add when it
 * doesn't. Never computed here — this component only ever displays what the
 * ingest pipeline or the "add nutrition" action already put on the record.
 */
export function NutritionFacts({
  recipe,
  shelvedId,
  clerkEnabled = true,
}: {
  recipe: Recipe;
  /** Null for an unsaved preview card — nothing to attach nutrition to yet. */
  shelvedId: string | null;
  clerkEnabled?: boolean;
}) {
  if (!recipe.nutrition) {
    return shelvedId ? (clerkEnabled ? <AuthenticatedNutrition recipeId={shelvedId} /> : <AddNutrition key={shelvedId} recipeId={shelvedId} />) : null;
  }

  const { perServing } = recipe.nutrition;
  const label = nutritionLabel(recipe.nutrition);
  const figures: [string, string | null][] = [
    ["Calories", perServing.calories === null ? null : String(Math.round(perServing.calories))],
    ["Protein", perServing.proteinGrams === null ? null : `${round1(perServing.proteinGrams)}g`],
    ["Carbs", perServing.carbGrams === null ? null : `${round1(perServing.carbGrams)}g`],
    ["Fat", perServing.fatGrams === null ? null : `${round1(perServing.fatGrams)}g`],
    ["Fiber", perServing.fiberGrams === null ? null : `${round1(perServing.fiberGrams)}g`],
    ["Sodium", perServing.sodiumMg === null ? null : `${Math.round(perServing.sodiumMg)}mg`],
  ];

  return (
    // No data-print attribute — this is content, not chrome, and belongs on
    // a printed page the same way the ingredient list does.
    <div className={styles.card}>
      <div className={styles.header}>
        <h3 className={styles.title}>Nutrition, per serving</h3>
        <span className={styles.badge} data-tone={label === "From the source" ? "good" : "warn"}>
          {label}
        </span>
      </div>
      <details>
        <summary>Show optional nutrition figures</summary>
        <p className={styles.disclaimer}>These are recipe estimates or published values per serving, not a record of what you ate. Missing values are unknown, not zero. You can leave this closed.</p>
        <dl className={styles.grid}>
          {figures.map(([name, value]) => (
            <div key={name}>
              <dt className={styles.label}>{name}</dt>
              <dd className={styles.value}>{value ?? "Not available"}</dd>
            </div>
          ))}
        </dl>
        <p className={styles.disclaimer}>{NUTRITION_DISCLAIMER}</p>
      </details>
    </div>
  );
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

function AuthenticatedNutrition({ recipeId }: { recipeId: string }) {
  const { isLoaded, userId, sessionId } = useAuth();
  if (!isLoaded) return <p role="status">Loading nutrition actions.</p>;
  if (!userId || !sessionId) return <p role="status">Sign in again before adding nutrition.</p>;
  return <AddNutrition key={`${sessionId}:${recipeId}`} recipeId={recipeId} sessionId={sessionId} />;
}

function AddNutrition({ recipeId, sessionId }: { recipeId: string; sessionId?: string }) {
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const alive = useRef(true);
  const started = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const add = async () => {
    if (!alive.current || started.current) return;
    started.current = true;
    setState("busy");
    try {
      const response = await fetch(`/api/recipes/${recipeId}/nutrition`, {
        method: "POST",
        headers: sessionId ? { "x-savortome-expected-session": sessionId } : undefined,
      });
      if (!response.ok) throw new Error("failed");
      // The server-rendered card won't show the new figures until the page
      // reloads — simplest correct thing for an action someone reaches for
      // once, not a control that needs to feel instant.
      if (alive.current) window.location.reload();
    } catch {
      if (alive.current) setState("error");
    }
  };

  return (
    <div className={styles.offer} data-print="hide" aria-busy={state === "busy"}>
      <button type="button" className={styles.addButton} disabled={state !== "idle"} onClick={() => void add()}>
        {state === "busy" ? "Estimating…" : "Add nutrition"}
      </button>
      {state === "error" ? (
        <span className={styles.offerNote} role="alert">
          This estimate is unconfirmed and may still finish. Reload this recipe to check before requesting another. Nothing retries automatically.
        </span>
      ) : (
        <span className={styles.offerNote}>
          A kitchen-scale estimate from the ingredient list, labelled as such.
        </span>
      )}
    </div>
  );
}
