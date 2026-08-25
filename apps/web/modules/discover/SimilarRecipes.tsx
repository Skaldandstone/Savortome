"use client";

import { useEffect, useState } from "react";
import type { DiscoverCard } from "@nomnom/core/format";
import { api } from "@/lib/client";
import { DiscoverCards } from "./DiscoverCards";
import styles from "./discover.module.css";

/**
 * "More like this" under a recipe, by what it's actually made of. Renders
 * nothing at all when there's no real overlap — an empty heading is worse than
 * no heading.
 */
export function SimilarRecipes({ recipeId }: { recipeId: string }) {
  const [cards, setCards] = useState<DiscoverCard[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const next = await api.similarRecipes(recipeId);
        if (!cancelled) setCards(next);
      } catch {
        // Similar recipes are a bonus; failing to load them shouldn't shout.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recipeId]);

  if (cards.length === 0) return null;

  return (
    <section className={styles.similar}>
      <h2 className={styles.similarHeading}>More like this</h2>
      <DiscoverCards cards={cards} />
    </section>
  );
}
