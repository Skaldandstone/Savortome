import { useCallback, useEffect, useState } from "react";
import type { PantryEntry, PantrySearchResponse } from "@nomnom/core/format";
import { api } from "@/lib/client";

export interface PantryController {
  items: PantryEntry[];
  loading: boolean;
  error: string | null;
  add: (text: string) => Promise<void>;
  remove: (canonicalItem: string) => Promise<void>;
  clear: () => Promise<void>;
}

/** What's in the kitchen. Same shape as the web hook, over the network client. */
export function usePantry(): PantryController {
  const [items, setItems] = useState<PantryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const next = await api.listPantry();
        if (!cancelled) setItems(next);
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
    add: (text) => run(() => api.addPantry(text)),
    remove: (canonicalItem) => run(() => api.removePantry([canonicalItem])),
    clear: () => run(() => api.clearPantry()),
  };
}

export interface SearchController {
  response: PantrySearchResponse | null;
  searching: boolean;
  error: string | null;
  search: (query: string) => Promise<void>;
}

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
