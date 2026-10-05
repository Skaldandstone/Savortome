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
  const { userId, sessionId } = useAuth();
  const api = useMemo(() => createAccountClient(userId ?? ""), [userId, sessionId]);
  // Invalidate retained handlers/results as soon as the auth scope renders,
  // including the interval before its old effect cleanup runs.
  const activeClient = useRef(api);
  activeClient.current = api;
  const dataClient = useRef(api);
  const mounted = useRef(true);
  const current = useCallback(() => mounted.current && activeClient.current === api, [api]);
  const [items, setItems] = useState<PantryEntry[]>([]);
  const [intakes, setIntakes] = useState<PantryIntakeView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    dataClient.current = api;
    let cancelled = false;
    setItems([]); setIntakes([]); setLoading(true); setError(null);
    void (async () => {
      try {
        const [next, pending] = await Promise.all([api.listPantry(), api.listPantryIntakes()]);
        if (!cancelled && current()) { setItems(next); setIntakes(pending); }
      } catch (err) {
        if (!cancelled && current()) setError(err instanceof Error ? err.message : "Couldn't load your pantry.");
      } finally {
        if (!cancelled && current()) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, [api, current]);

  const run = useCallback(async (write: () => Promise<PantryEntry[]>) => {
    if (!current()) return;
    setError(null);
    try {
      const next = await write();
      if (current()) setItems(next);
    } catch (err) {
      if (current()) setError(err instanceof Error ? err.message : "That didn't save.");
    }
  }, [current]);

  return {
    items: dataClient.current === api ? items : [],
    intakes: dataClient.current === api ? intakes : [],
    loading: dataClient.current !== api || loading,
    queuedIntake: intake => { if (current()) setIntakes(items => [intake, ...items.filter(item => item.id !== intake.id)]); },
    error: dataClient.current === api ? error : null,
    add: (text) => run(() => api.addPantry(text)),
    update: (entry) => run(() => api.updatePantry(entry)),
    remove: (canonicalItem) => run(() => api.removePantry([canonicalItem])),
    clear: () => run(() => api.clearPantry()),
    scanReceipt: async (imageBase64, imageMediaType) => {
      if (!current()) return false;
      setError(null);
      try {
        const result = await api.scanPantryReceipt(imageBase64, imageMediaType);
        if (!current()) return false;
        setIntakes(result.intakes);
        return true;
      } catch (err) {
        if (current()) setError(err instanceof Error ? err.message : "That receipt could not be read.");
        return false;
      }
    },
    resolveIntake: async (intakeId, action, acceptedItemIds = []) => {
      if (!current()) return false;
      setError(null);
      try {
        const result = await api.resolvePantryIntake({ intakeId, action, acceptedItemIds });
        if (!current()) return false;
        setItems(result.pantry);
        setIntakes(result.intakes);
        return true;
      } catch (err) {
        if (current()) setError(err instanceof Error ? err.message : "That grocery review did not save.");
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
