"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  NUTRITION_DISCLAIMER,
  summarizeMeal,
  type PairingCandidate,
  type PairingSlot,
  type PairingSuggestions as Suggestions,
  type RecipeNutrition,
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

  useEffect(() => {
    if (!recipeId) return;
    let cancelled = false;
    void (async () => {
      try {
        const next = await api.pairings(recipeId);
        if (cancelled) return;
        setSuggestions(next);
        // Default to the top-ranked candidate that actually has nutrition to
        // contribute — picking one with nothing to add would make the total
        // look complete while quietly leaving a course out of it.
        setSelected((prev) => {
          const out = { ...prev };
          for (const slot of SLOTS) {
            out[slot] = next[slot].find((c) => c.nutrition)?.id ?? null;
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
    <section className={styles.pairings} data-print="hide">
      <h3 className={styles.heading}>Pairs well with</h3>
      <div className={styles.slots}>
        {slots.map((slot) => (
          <div key={slot} className={styles.slot}>
            <span className={styles.slotLabel}>{SLOT_LABEL[slot]}</span>
            <ul className={styles.list}>
              {suggestions[slot].map((candidate) => (
                <li key={candidate.id} className={styles.item}>
                  {mainNutrition ? (
                    <label className={styles.pick}>
                      <input
                        type="checkbox"
                        checked={selected[slot] === candidate.id}
                        onChange={() =>
                          setSelected((prev) => ({
                            ...prev,
                            [slot]: prev[slot] === candidate.id ? null : candidate.id,
                          }))
                        }
                      />
                      {!candidate.nutrition ? (
                        <span className={styles.noNutrition}>no nutrition yet</span>
                      ) : null}
                    </label>
                  ) : null}
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
    </section>
  );
}
