"use client";

import { useCallback, useEffect, useState } from "react";
import type { PantryEntry, PantryEntryUpdate, PantryIntakeView, PantrySearchResponse } from "@seconds/core/format";
import { api } from "@/lib/client";
import { actionFailure, type ActionFailure } from "@/lib/action-failure";

export interface PantryController {
  items: PantryEntry[];
  loading: boolean;
  loaded: boolean;
  pantryError: ActionFailure | null;
  error: ActionFailure | null;
  intakes: PantryIntakeView[];
  intakesLoading: boolean;
  intakesLoaded: boolean;
  intakesError: ActionFailure | null;
  retryPantry: () => void;
  retryIntakes: () => void;
  add: (text: string) => Promise<boolean>;
  update: (update: PantryEntryUpdate) => Promise<boolean>;
  remove: (canonicalItem: string) => Promise<boolean>;
  clear: () => Promise<boolean>;
  resolveIntake: (intakeId: string, action: "accept" | "dismiss", acceptedItemIds?: string[]) => Promise<boolean>;
}

/** What's in the kitchen. Kept separate from searching so either can be used alone. */
export function usePantry(): PantryController {
  const [items, setItems] = useState<PantryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [pantryError, setPantryError] = useState<ActionFailure | null>(null);
  const [error, setError] = useState<ActionFailure | null>(null);
  const [intakes, setIntakes] = useState<PantryIntakeView[]>([]);
  const [intakesLoading, setIntakesLoading] = useState(true);
  const [intakesLoaded, setIntakesLoaded] = useState(false);
  const [intakesError, setIntakesError] = useState<ActionFailure | null>(null);
  const [pantryAttempt, setPantryAttempt] = useState(0);
  const [intakesAttempt, setIntakesAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPantryError(null);
    void (async () => {
      try {
        const next = await api.listPantry();
        if (!cancelled) {
          setItems(next);
          setLoaded(true);
        }
      } catch (err) {
        if (!cancelled) setPantryError(actionFailure(err, "Couldn't load your pantry."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pantryAttempt]);

  useEffect(() => {
    let cancelled = false;
    setIntakesLoading(true);
    setIntakesError(null);
    void (async () => {
      try {
        const pending = await api.listPantryIntakes();
        if (!cancelled) {
          setIntakes(pending);
          setIntakesLoaded(true);
        }
      } catch (err) {
        if (!cancelled) setIntakesError(actionFailure(err, "Couldn't load recent grocery reviews."));
      } finally {
        if (!cancelled) setIntakesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [intakesAttempt]);

  const resolveIntake = useCallback(async (
    intakeId: string,
    action: "accept" | "dismiss",
    acceptedItemIds: string[] = [],
  ) => {
    setError(null);
    try {
      const next = await api.resolvePantryIntake({ intakeId, action, acceptedItemIds });
      setItems(next.pantry);
      setIntakes(next.intakes);
      return true;
    } catch (err) {
      setError(actionFailure(err, "That pantry review did not save."));
      return false;
    }
  }, []);

  const run = useCallback(async (write: () => Promise<PantryEntry[]>): Promise<boolean> => {
    setError(null);
    try {
      setItems(await write());
      return true;
    } catch (err) {
      setError(actionFailure(err, "That didn't save."));
      return false;
    }
  }, []);

  return {
    items,
    loading,
    loaded,
    pantryError,
    error,
    intakes,
    intakesLoading,
    intakesLoaded,
    intakesError,
    retryPantry: () => setPantryAttempt(current => current + 1),
    retryIntakes: () => setIntakesAttempt(current => current + 1),
    add: (text) => run(() => api.addPantry(text)),
    update: (update) => run(() => api.updatePantry(update)),
    remove: (canonicalItem) => run(() => api.removePantry([canonicalItem])),
    clear: () => run(() => api.clearPantry()),
    resolveIntake,
  };
}

export interface SearchController {
  response: PantrySearchResponse | null;
  searching: boolean;
  error: ActionFailure | null;
  search: (query: string) => Promise<void>;
}

/** "What can I make" — either from typed text or from the saved pantry. */
export function usePantrySearch(): SearchController {
  const [response, setResponse] = useState<PantrySearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<ActionFailure | null>(null);

  const search = useCallback(async (query: string) => {
    setSearching(true);
    setError(null);
    try {
      setResponse(await api.searchPantry(query));
    } catch (err) {
      setError(actionFailure(err, "That search didn't work."));
    } finally {
      setSearching(false);
    }
  }, []);

  return { response, searching, error, search };
}
