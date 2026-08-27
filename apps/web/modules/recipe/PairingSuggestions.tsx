"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PairingSlot, PairingSuggestions as Suggestions } from "@seconds/core/format";
import { api } from "@/lib/client";
import styles from "./PairingSuggestions.module.css";

const SLOT_LABEL: Record<PairingSlot, string> = {
  side: "A side",
  drink: "A drink",
  dessert: "A dessert",
};

const EMPTY: Suggestions = { side: [], drink: [], dessert: [] };

/**
 * "Pairs well with" — a side, a drink, and a dessert pulled from your own
 * library, not generated. Renders nothing when signed out, or when nothing in
 * the library fits any of the three slots.
 */
export function PairingSuggestions({ recipeId }: { recipeId: string | null }) {
  const [suggestions, setSuggestions] = useState<Suggestions>(EMPTY);

  useEffect(() => {
    if (!recipeId) return;
    let cancelled = false;
    void (async () => {
      try {
        const next = await api.pairings(recipeId);
        if (!cancelled) setSuggestions(next);
      } catch {
        // A missing suggestion row is a quiet no-op, not an error banner.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recipeId]);

  const slots = (Object.keys(SLOT_LABEL) as PairingSlot[]).filter(
    (slot) => suggestions[slot].length > 0,
  );
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
                <li key={candidate.id}>
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
    </section>
  );
}
