import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getClerkInstance, useAuth } from "@clerk/expo";
import type { PantryEntry, PantryEntryUpdate, PantryIntakeView, PantrySearchResponse, PhotoMediaType } from "@seconds/core/format";
import { createAccountClient } from "@/lib/client";

export interface PantryController {
  items: PantryEntry[];
  intakes: PantryIntakeView[];
  loading: boolean;
  refreshingReviews: boolean;
  refreshReviews: () => Promise<boolean>;
  queuedIntake: (intake: PantryIntakeView) => void;
  error: string | null;
  add: (text: string) => Promise<void>;
  update: (entry: PantryEntryUpdate) => Promise<boolean>;
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
  const current = useCallback(() => {
    if (!mounted.current || activeClient.current !== api) return false;
    try {
      const session = getClerkInstance().session;
      return !!userId && !!sessionId && session?.user.id === userId && session.id === sessionId;
    } catch { return false; }
  }, [api, userId, sessionId]);
  const [items, setItems] = useState<PantryEntry[]>([]);
  const [intakes, setIntakes] = useState<PantryIntakeView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshingReviews, setRefreshingReviews] = useState(false);
  const reviewVersion = useRef(0);
  const refreshFlight = useRef<object | null>(null);

  useEffect(() => {
    mounted.current = true;
    dataClient.current = api;
    let cancelled = false;
    const version = ++reviewVersion.current;
    refreshFlight.current = null; setRefreshingReviews(false);
    setItems([]); setIntakes([]); setLoading(true); setError(null);
    void (async () => {
      try {
        const [next, pending] = await Promise.all([api.listPantry(), api.listPantryIntakes()]);
        if (!cancelled && current() && reviewVersion.current === version) { setItems(next); setIntakes(pending); }
      } catch (err) {
        if (!cancelled && current() && reviewVersion.current === version) setError(err instanceof Error ? err.message : "Couldn't load your pantry.");
      } finally {
        if (!cancelled && current()) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, [api, current]);

  const run = useCallback(async (write: () => Promise<PantryEntry[]>, verify: (items: PantryEntry[]) => boolean = () => true) => {
    if (!current()) return false;
    ++reviewVersion.current;
    setError(null);
    try {
      const next = await write();
      if (!current()) return false;
      if (!Array.isArray(next) || !verify(next)) throw new Error("We could not confirm that pantry change. Review the latest pantry before trying again.");
      ++reviewVersion.current; setItems(next); return true;
    } catch (err) {
      if (current()) setError(err instanceof Error ? err.message : "That didn't save.");
      return false;
    }
  }, [current]);

  return {
    items: dataClient.current === api ? items : [],
    intakes: dataClient.current === api ? intakes : [],
    loading: dataClient.current !== api || loading,
    refreshingReviews: dataClient.current === api && refreshingReviews,
    refreshReviews: async () => {
      if (!current() || refreshFlight.current) return false;
      const flight = {}; refreshFlight.current = flight;
      const version = ++reviewVersion.current;
      setRefreshingReviews(true); setError(null);
      try {
        const [next, pending] = await Promise.all([api.listPantry(), api.listPantryIntakes()]);
        if (!current() || reviewVersion.current !== version) return false;
        setItems(next); setIntakes(pending);
        return true;
      } catch {
        if (current() && reviewVersion.current === version) setError("We could not confirm the latest grocery reviews. Your last loaded reviews are still here. Refresh again before rescanning or repeating an uncertain action.");
        return false;
      } finally {
        if (current() && refreshFlight.current === flight) { refreshFlight.current = null; setRefreshingReviews(false); }
      }
    },
    queuedIntake: intake => { if (current()) { ++reviewVersion.current; setIntakes(items => [intake, ...items.filter(item => item.id !== intake.id)]); } },
    error: dataClient.current === api ? error : null,
    add: async text => { await run(() => api.addPantry(text)); },
    update: entry => {
      const input = { ...entry };
      return run(() => api.updatePantry(input), next => next.some(item => item?.canonicalItem === input.canonicalItem
        && (input.quantity === undefined || item.quantity === input.quantity)
        && (input.unit === undefined || item.unit === input.unit)));
    },
    remove: async canonicalItem => { await run(() => api.removePantry([canonicalItem])); },
    clear: async () => { await run(() => api.clearPantry()); },
    scanReceipt: async (imageBase64, imageMediaType) => {
      if (!current()) return false;
      ++reviewVersion.current;
      setError(null);
      try {
        const result = await api.scanPantryReceipt(imageBase64, imageMediaType);
        if (!current()) return false;
        ++reviewVersion.current; setIntakes(result.intakes);
        return true;
      } catch (err) {
        if (current()) setError(err instanceof Error ? err.message : "That receipt could not be read.");
        return false;
      }
    },
    resolveIntake: async (intakeId, action, acceptedItemIds = []) => {
      if (!current()) return false;
      ++reviewVersion.current;
      setError(null);
      try {
        const result = await api.resolvePantryIntake({ intakeId, action, acceptedItemIds });
        if (!current()) return false;
        ++reviewVersion.current; setItems(result.pantry);
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
  const { userId, sessionId } = useAuth();
  const api = useMemo(() => createAccountClient(userId ?? ""), [userId, sessionId]);
  const activeClient = useRef(api);
  activeClient.current = api;
  const dataClient = useRef(api);
  const mounted = useRef(true);
  const current = useCallback(() => {
    if (!mounted.current || activeClient.current !== api) return false;
    try {
      const session = getClerkInstance().session;
      return !!userId && !!sessionId && session?.user.id === userId && session.id === sessionId;
    } catch { return false; }
  }, [api, userId, sessionId]);
  const request = useRef(0);
  const [response, setResponse] = useState<PantrySearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    mounted.current = true; dataClient.current = api;
    ++request.current; setResponse(null); setSearching(false); setError(null);
    return () => { mounted.current = false; ++request.current; };
  }, [api]);

  const search = useCallback(async (query: string) => {
    if (!current()) return;
    const version = ++request.current;
    setSearching(true);
    setError(null);
    try {
      const result = await api.searchPantry(query);
      if (current() && request.current === version) setResponse(result);
    } catch (err) {
      if (current() && request.current === version) setError(err instanceof Error ? err.message : "That search didn't work.");
    } finally {
      if (current() && request.current === version) setSearching(false);
    }
  }, [api, current]);

  return {
    response: dataClient.current === api ? response : null,
    searching: dataClient.current === api && searching,
    error: dataClient.current === api ? error : null,
    search,
  };
}
