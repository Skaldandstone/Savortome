"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import {
  NUTRITION_DISCLAIMER,
  summarizeMeal,
  type PairingCandidate,
  type PairingSlot,
  type PairingSuggestions as Suggestions,
  type RecipeNutrition,
  type TemplateRole,
} from "@seconds/core/format";
import { api } from "@/lib/client";
import styles from "./PairingSuggestions.module.css";

const SLOT_LABEL: Record<PairingSlot, string> = {
  side: "A side",
  drink: "A drink",
  dessert: "A dessert",
};

const EMPTY: Suggestions = { side: [], drink: [], dessert: [] };
const SLOTS = Object.keys(SLOT_LABEL) as PairingSlot[];

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * "Pairs well with" — a side, a drink, and a dessert pulled from your own
 * library, not generated. Renders nothing when signed out, or when nothing in
 * the library fits any of the three slots.
 *
 * When the main dish has nutrition, one candidate per slot can be picked to
 * build a full-meal total: per guest, and for however many are coming.
 */
export function PairingSuggestions({
  recipeId,
  mainNutrition,
  servings,
}: {
  recipeId: string | null;
  mainNutrition: RecipeNutrition | null;
  servings: number | null;
}) {
  const [suggestions, setSuggestions] = useState<Suggestions>(EMPTY);
  const [selected, setSelected] = useState<Record<PairingSlot, string | null>>({
    side: null,
    drink: null,
    dessert: null,
  });
  const [guests, setGuests] = useState(servings && servings > 0 ? servings : 4);
  const [mealName, setMealName] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const headingId = useId();

  useEffect(() => {
    if (!recipeId) return;
    let cancelled = false;
    void (async () => {
      try {
        const next = await api.pairings(recipeId);
        if (cancelled) return;
        setSuggestions(next);
        // Default to the top-ranked candidate that actually has nutrition to
        // contribute, so a full-meal total starts complete rather than
        // quietly missing a course; falling back to the top pick either way
        // means there's always something ready to save as a meal.
        setSelected((prev) => {
          const out = { ...prev };
          for (const slot of SLOTS) {
            out[slot] = next[slot].find((c) => c.nutrition)?.id ?? next[slot][0]?.id ?? null;
          }
          return out;
        });
      } catch {
        // A missing suggestion row is a quiet no-op, not an error banner.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recipeId]);

  const slots = SLOTS.filter((slot) => suggestions[slot].length > 0);

  const byId = useMemo(() => {
    const map = new Map<string, PairingCandidate>();
    for (const slot of SLOTS) for (const c of suggestions[slot]) map.set(c.id, c);
    return map;
  }, [suggestions]);

  const meal = useMemo(() => {
    if (!mainNutrition) return null;
    const dishes = [mainNutrition];
    for (const slot of SLOTS) {
      const chosen = selected[slot] ? byId.get(selected[slot]!) : null;
      if (chosen?.nutrition) dishes.push(chosen.nutrition);
    }
    return summarizeMeal(dishes, guests);
  }, [mainNutrition, selected, byId, guests]);

  if (slots.length === 0) return null;

  return (
    <section className={styles.pairings} data-print="hide" aria-labelledby={headingId}>
      <h3 id={headingId} className={styles.heading}>Pairs well with</h3>
      <div className={styles.slots}>
        {slots.map((slot) => (
          <div key={slot} className={styles.slot}>
            <span className={styles.slotLabel}>{SLOT_LABEL[slot]}</span>
            <ul className={styles.list}>
              {suggestions[slot].map((candidate) => (
                <li key={candidate.id} className={styles.item}>
                  <label className={styles.pick}>
                    <input
                      type="checkbox"
                      aria-label={`Include ${candidate.title} as ${SLOT_LABEL[slot].toLowerCase()} in this meal`}
                      checked={selected[slot] === candidate.id}
                      onChange={() =>
                        setSelected((prev) => ({
                          ...prev,
                          [slot]: prev[slot] === candidate.id ? null : candidate.id,
                        }))
                      }
                    />
                    {mainNutrition && !candidate.nutrition ? (
                      <span className={styles.noNutrition}>no nutrition yet</span>
                    ) : null}
                  </label>
                  <Link className={styles.card} href={`/recipe/${candidate.id}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img className={styles.thumb} src={candidate.imageUrl ?? undefined} alt="" />
                    <span className={styles.title}>{candidate.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {meal ? (
        <div className={styles.meal}>
          <div className={styles.mealHeader}>
            <h4 className={styles.mealTitle}>Full meal</h4>
            <span className={styles.badge}>{meal.label}</span>
          </div>
          <label className={styles.guests}>
            Guests
            <input
              type="number"
              min={1}
              value={guests}
              onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))}
            />
          </label>
          <dl className={styles.mealGrid}>
            <div>
              <dt>Per guest</dt>
              <dd>
                {meal.perGuest.calories === null ? "—" : `${Math.round(meal.perGuest.calories)} cal`}
              </dd>
            </div>
            <div>
              <dt>Total for {meal.guests}</dt>
              <dd>{meal.total.calories === null ? "—" : `${Math.round(meal.total.calories)} cal`}</dd>
            </div>
            {meal.perGuest.proteinGrams !== null ? (
              <div>
                <dt>Protein / guest</dt>
                <dd>{round1(meal.perGuest.proteinGrams)}g</dd>
              </div>
            ) : null}
          </dl>
          <p className={styles.disclaimer}>{NUTRITION_DISCLAIMER}</p>
        </div>
      ) : null}

      <div className={styles.saveMeal} aria-busy={saveState === "saving"}>
        {saveState !== "saved" ? (
          <input
            type="text"
            className={styles.saveMealName}
            aria-label="Meal name"
            placeholder="Name this meal (e.g. Taco Night)"
            value={mealName}
            onChange={(e) => setMealName(e.target.value)}
          />
        ) : null}
        <button
          type="button"
          className={styles.saveMealButton}
          disabled={saveState === "saving" || saveState === "saved" || !recipeId}
          onClick={async () => {
            if (!recipeId) return;
            setSaveState("saving");
            setSaveError(null);
            try {
              const items: { role: TemplateRole; recipeId: string }[] = [{ role: "main", recipeId }];
              for (const slot of SLOTS) {
                const id = selected[slot];
                if (id) items.push({ role: slot, recipeId: id });
              }
              await api.createTemplate(mealName, items);
              setSaveState("saved");
            } catch (err) {
              setSaveState("failed");
              setSaveError(err instanceof Error ? err.message : "Couldn't save that.");
            }
          }}
        >
          {saveState === "saving" ? "Saving…" : saveState === "saved" ? "Saved ✓" : "Save this meal"}
        </button>
        {saveState === "saved" ? (
          <span className={styles.saveMealNote} role="status">
            See it, name it, or share it from <a href="/templates">your meals</a>.
          </span>
        ) : saveError ? (
          <span className={styles.saveMealNote} role="alert">{saveError}</span>
        ) : null}
      </div>
    </section>
  );
}
