"use client";

import { useCallback, useEffect, useState } from "react";
import type { PantryEntry, PantryEntryUpdate, PantryIntakeView, PantrySearchResponse } from "@seconds/core/format";
import { api } from "@/lib/client";

export interface PantryController {
  items: PantryEntry[];
  loading: boolean;
  error: string | null;
  intakes: PantryIntakeView[];
  add: (text: string) => Promise<void>;
  update: (update: PantryEntryUpdate) => Promise<void>;
  remove: (canonicalItem: string) => Promise<void>;
  clear: () => Promise<void>;
  resolveIntake: (intakeId: string, action: "accept" | "dismiss", acceptedItemIds?: string[]) => Promise<boolean>;
}

/** What's in the kitchen. Kept separate from searching so either can be used alone. */
export function usePantry(): PantryController {
  const [items, setItems] = useState<PantryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [intakes, setIntakes] = useState<PantryIntakeView[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [next, pending] = await Promise.all([api.listPantry(), api.listPantryIntakes()]);
        if (!cancelled) {
          setItems(next);
          setIntakes(pending);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load your pantry.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
      setError(err instanceof Error ? err.message : "That pantry review did not save.");
      return false;
    }
  }, []);

  const run = useCallback(async (write: () => Promise<PantryEntry[]>) => {
    setError(null);
    try {
      setItems(await write());
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't save.");
    }
  }, []);

  return {
    items,
    loading,
    error,
    intakes,
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
  error: string | null;
  search: (query: string) => Promise<void>;
}

/** "What can I make" — either from typed text or from the saved pantry. */
export function usePantrySearch(): SearchController {
  const [response, setResponse] = useState<PantrySearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string) => {
    setSearching(true);
    setError(null);
    try {
      setResponse(await api.searchPantry(query));
    } catch (err) {
      setError(err instanceof Error ? err.message : "That search didn't work.");
    } finally {
      setSearching(false);
    }
  }, []);

  return { response, searching, error, search };
}
