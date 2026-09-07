"use client";

import { useState } from "react";
import {
  NUTRITION_DISCLAIMER,
  nutritionLabel,
  type Recipe,
} from "@seconds/core/format";
import styles from "./NutritionFacts.module.css";

/**
 * The per-serving figures, and the honesty about where they came from.
 *
 * Shown whenever a recipe has nutrition; offered as something to add when it
 * doesn't. Never computed here — this component only ever displays what the
 * ingest pipeline or the "add nutrition" action already put on the record.
 */
export function NutritionFacts({
  recipe,
  shelvedId,
}: {
  recipe: Recipe;
  /** Null for an unsaved preview card — nothing to attach nutrition to yet. */
  shelvedId: string | null;
}) {
  if (!recipe.nutrition) {
    return shelvedId ? <AddNutrition recipeId={shelvedId} /> : null;
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
  ].filter((f): f is [string, string] => f[1] !== null);

  if (figures.length === 0) return null;

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
      <dl className={styles.grid}>
        {figures.map(([name, value]) => (
          <div key={name}>
            <dt className={styles.label}>{name}</dt>
            <dd className={styles.value}>{value}</dd>
          </div>
        ))}
      </dl>
      <p className={styles.disclaimer}>{NUTRITION_DISCLAIMER}</p>
    </div>
  );
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

function AddNutrition({ recipeId }: { recipeId: string }) {
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");

  const add = async () => {
    setState("busy");
    try {
      const response = await fetch(`/api/recipes/${recipeId}/nutrition`, { method: "POST" });
      if (!response.ok) throw new Error("failed");
      // The server-rendered card won't show the new figures until the page
      // reloads — simplest correct thing for an action someone reaches for
      // once, not a control that needs to feel instant.
      window.location.reload();
    } catch {
      setState("error");
    }
  };

  return (
    <div className={styles.offer} data-print="hide" aria-busy={state === "busy"}>
      <button type="button" className={styles.addButton} disabled={state === "busy"} onClick={() => void add()}>
        {state === "busy" ? "Estimating…" : "Add nutrition"}
      </button>
      {state === "error" ? (
        <span className={styles.offerNote} role="alert">
          Couldn't add nutrition just now — try again in a moment.
        </span>
      ) : (
        <span className={styles.offerNote}>
          A kitchen-scale estimate from the ingredient list, labelled as such.
        </span>
      )}
    </div>
  );
}
