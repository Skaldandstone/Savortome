import { useCallback, useEffect, useState } from "react";
import {
  applyRating,
  applyShelfMembership,
  applyStatus,
  nextStatus,
  type RecipeShelfState,
  type ShelfSummary,
  type StatusShelf,
} from "@seconds/core/format";
import { api } from "@/lib/client";

export interface ShelfController {
  shelves: ShelfSummary[];
  state: RecipeShelfState | null;
  saving: boolean;
  error: string | null;
  setStatus: (pressed: StatusShelf) => Promise<void>;
  toggleShelf: (shelfId: string, member: boolean) => Promise<void>;
  createShelf: (name: string) => Promise<void>;
  rate: (stars: number) => Promise<void>;
}

/**
 * Shelf and rating state for one recipe. The decisions live in
 * `@seconds/core/format`; this is the React shell around them.
 */
export function useShelfState(recipeId: string | null): ShelfController {
  const [shelves, setShelves] = useState<ShelfSummary[]>([]);
  const [state, setState] = useState<RecipeShelfState | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!recipeId) return;
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
  }, [recipeId]);

  /** Show the change now, keep the server's answer, roll back if it fails. */
  const mutate = useCallback(
    async (optimistic: RecipeShelfState, write: () => Promise<RecipeShelfState>) => {
      const previous = state;
      setState(optimistic);
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
    async (pressed: StatusShelf) => {
      if (!recipeId || !state) return;
      const next = nextStatus(state.status, pressed);
      await mutate(applyStatus(state, next), () => api.setStatus(recipeId, next));
    },
    [recipeId, state, mutate],
  );

  const toggleShelf = useCallback(
    async (shelfId: string, member: boolean) => {
      if (!recipeId || !state) return;
      await mutate(applyShelfMembership(state, shelfId, member), () =>
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
    async (stars: number) => {
      if (!recipeId || !state) return;
      await mutate(applyRating(state, stars), async () => ({
        ...state,
        rating: await api.rateRecipe(recipeId, stars),
      }));
    },
    [recipeId, state, mutate],
  );

  return { shelves, state, saving, error, setStatus, toggleShelf, createShelf, rate };
}
