"use client";

import { useCallback, useEffect, useState } from "react";
import type { RecipeShelfState, ShelfSummary, StatusShelf } from "@nomnom/core/format";
import { api } from "@/lib/client";

export interface ShelfController {
  shelves: ShelfSummary[];
  state: RecipeShelfState | null;
  /** True while a write is in flight. Controls stay usable; they just look busy. */
  saving: boolean;
  error: string | null;
  setStatus: (status: StatusShelf | null) => Promise<void>;
  toggleShelf: (shelfId: string, member: boolean) => Promise<void>;
  createShelf: (name: string) => Promise<void>;
  rate: (stars: number, review?: string | null) => Promise<void>;
}

/**
 * Shelf and rating state for one recipe.
 *
 * Every mutation applies optimistically and rolls back on failure — these are
 * one-tap controls, and waiting on a round-trip to see a star fill in makes the
 * whole thing feel broken.
 */
export function useShelfState(recipeId: string | null, enabled = true): ShelfController {
  const [shelves, setShelves] = useState<ShelfSummary[]>([]);
  const [state, setState] = useState<RecipeShelfState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !recipeId) return;
    let cancelled = false;

    void (async () => {
      try {
        const [nextShelves, nextState] = await Promise.all([
          api.listShelves(),
          api.getShelfState(recipeId),
        ]);
        if (cancelled) return;
        setShelves(nextShelves);
        setState(nextState);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load shelves.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [recipeId, enabled]);

  /** Apply an optimistic state, run the write, keep the server's answer, roll back on failure. */
  const mutate = useCallback(
    async (optimistic: RecipeShelfState | null, write: () => Promise<RecipeShelfState>) => {
      const previous = state;
      if (optimistic) setState(optimistic);
      setSaving(true);
      setError(null);
      try {
        setState(await write());
      } catch (err) {
        setState(previous);
        setError(err instanceof Error ? err.message : "That didn't save.");
      } finally {
        setSaving(false);
      }
    },
    [state],
  );

  const setStatus = useCallback(
    async (status: StatusShelf | null) => {
      if (!recipeId || !state) return;
      // Toggling the shelf you're already on takes the recipe off it.
      const next = state.status === status ? null : status;
      await mutate({ ...state, status: next }, () => api.setStatus(recipeId, next));
    },
    [recipeId, state, mutate],
  );

  const toggleShelf = useCallback(
    async (shelfId: string, member: boolean) => {
      if (!recipeId || !state) return;
      const shelfIds = member
        ? [...new Set([...state.shelfIds, shelfId])]
        : state.shelfIds.filter((id) => id !== shelfId);
      await mutate({ ...state, shelfIds }, () =>
        api.setShelfMembership(recipeId, shelfId, member),
      );
    },
    [recipeId, state, mutate],
  );

  const createShelf = useCallback(async (name: string) => {
    setSaving(true);
    setError(null);
    try {
      const shelf = await api.createShelf(name);
      setShelves((current) => [...current, shelf]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create that shelf.");
    } finally {
      setSaving(false);
    }
  }, []);

  const rate = useCallback(
    async (stars: number, review: string | null = null) => {
      if (!recipeId || !state) return;
      const optimistic: RecipeShelfState = {
        ...state,
        rating: {
          stars,
          review,
          timesCooked: state.rating?.timesCooked ?? 0,
          lastCookedAt: state.rating?.lastCookedAt ?? null,
        },
      };
      await mutate(optimistic, async () => {
        const rating = await api.rateRecipe(recipeId, stars, review);
        return { ...state, rating };
      });
    },
    [recipeId, state, mutate],
  );

  return { shelves, state, saving, error, setStatus, toggleShelf, createShelf, rate };
}
