import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/expo";
import type { PantryEntry, PantryEntryUpdate, PantryIntakeView, PantrySearchResponse, PhotoMediaType } from "@seconds/core/format";
import { createAccountClient } from "@/lib/client";

export interface PantryController {
  items: PantryEntry[];
  intakes: PantryIntakeView[];
  loading: boolean;
  queuedIntake: (intake: PantryIntakeView) => void;
  error: string | null;
  add: (text: string) => Promise<void>;
  update: (entry: PantryEntryUpdate) => Promise<void>;
  remove: (canonicalItem: string) => Promise<void>;
  clear: () => Promise<void>;
  scanReceipt: (imageBase64: string, imageMediaType: PhotoMediaType) => Promise<boolean>;
  resolveIntake: (intakeId: string, action: "accept" | "dismiss", acceptedItemIds?: string[]) => Promise<boolean>;
}

/** What's in the kitchen. Same shape as the web hook, over the network client. */
export function usePantry(): PantryController {
  const { userId } = useAuth();
  const api = useMemo(() => createAccountClient(userId ?? ""), [userId]);
  const [items, setItems] = useState<PantryEntry[]>([]);
  const [intakes, setIntakes] = useState<PantryIntakeView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setItems([]); setIntakes([]); setLoading(true); setError(null);
    void (async () => {
      try {
        const [next, pending] = await Promise.all([api.listPantry(), api.listPantryIntakes()]);
        if (!cancelled) { setItems(next); setIntakes(pending); }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load your pantry.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const run = useCallback(async (write: () => Promise<PantryEntry[]>) => {
    setError(null);
    try {
      setItems(await write());
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't save.");
    }
  }, [api]);

  return {
    items,
    intakes,
    loading,
    queuedIntake: intake => setIntakes(current => [intake, ...current.filter(item => item.id !== intake.id)]),
    error,
    add: (text) => run(() => api.addPantry(text)),
    update: (entry) => run(() => api.updatePantry(entry)),
    remove: (canonicalItem) => run(() => api.removePantry([canonicalItem])),
    clear: () => run(() => api.clearPantry()),
    scanReceipt: async (imageBase64, imageMediaType) => {
      setError(null);
      try {
        const result = await api.scanPantryReceipt(imageBase64, imageMediaType);
        setIntakes(result.intakes);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "That receipt could not be read.");
        return false;
      }
    },
    resolveIntake: async (intakeId, action, acceptedItemIds = []) => {
      setError(null);
      try {
        const result = await api.resolvePantryIntake({ intakeId, action, acceptedItemIds });
        setItems(result.pantry);
        setIntakes(result.intakes);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "That grocery review did not save.");
        return false;
      }
    },
  };
}

export interface SearchController {
  response: PantrySearchResponse | null;
  searching: boolean;
  error: string | null;
  search: (query: string) => Promise<void>;
}

export function usePantrySearch(): SearchController {
  const { userId } = useAuth();
  const api = useMemo(() => createAccountClient(userId ?? ""), [userId]);
  const request = useRef(0);
  const [response, setResponse] = useState<PantrySearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    ++request.current; setResponse(null); setSearching(false); setError(null);
    return () => { ++request.current; };
  }, [api]);

  const search = useCallback(async (query: string) => {
    const version = ++request.current;
    setSearching(true);
    setError(null);
    try {
      const result = await api.searchPantry(query);
      if (request.current === version) setResponse(result);
    } catch (err) {
      if (request.current === version) setError(err instanceof Error ? err.message : "That search didn't work.");
    } finally {
      if (request.current === version) setSearching(false);
    }
  }, [api]);

  return { response, searching, error, search };
}
