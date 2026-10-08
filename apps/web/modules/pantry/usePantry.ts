"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PantryEntry, PantryEntryUpdate, PantryIntakeView, PantrySearchResponse } from "@seconds/core/format";
import { api as defaultApi } from "@/lib/client";
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
export function usePantry(api = defaultApi): PantryController {
  const activeClient = useRef(api);
  activeClient.current = api;
  const dataClient = useRef(api);
  const mounted = useRef(true);
  const current = useCallback(() => mounted.current && activeClient.current === api, [api]);

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
  const pantryVersion = useRef(0);
  const intakesVersion = useRef(0);

  useEffect(() => {
    mounted.current = true; dataClient.current = api;
    setItems([]); setIntakes([]); setLoaded(false); setIntakesLoaded(false);
    setError(null); setPantryError(null); setIntakesError(null);
    return () => { mounted.current = false; };
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    const version = ++pantryVersion.current;
    setLoading(true);
    setPantryError(null);
    void (async () => {
      try {
        const next = await api.listPantry();
        if (!cancelled && current() && pantryVersion.current === version) {
          setItems(next);
          setLoaded(true);
        }
      } catch (err) {
        if (!cancelled && current() && pantryVersion.current === version) setPantryError(actionFailure(err, "Couldn't load your pantry."));
      } finally {
        if (!cancelled && current() && pantryVersion.current === version) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, current, pantryAttempt]);

  useEffect(() => {
    let cancelled = false;
    const version = ++intakesVersion.current;
    setIntakesLoading(true);
    setIntakesError(null);
    void (async () => {
      try {
        const pending = await api.listPantryIntakes();
        if (!cancelled && current() && intakesVersion.current === version) {
          setIntakes(pending);
          setIntakesLoaded(true);
        }
      } catch (err) {
        if (!cancelled && current() && intakesVersion.current === version) setIntakesError(actionFailure(err, "Couldn't load recent grocery reviews."));
      } finally {
        if (!cancelled && current() && intakesVersion.current === version) setIntakesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, current, intakesAttempt]);

  const resolveIntake = useCallback(async (
    intakeId: string,
    action: "accept" | "dismiss",
    acceptedItemIds: string[] = [],
  ) => {
    if (!current()) return false;
    setError(null);
    try {
      const next = await api.resolvePantryIntake({ intakeId, action, acceptedItemIds });
      if (!current()) return false;
      ++pantryVersion.current; ++intakesVersion.current;
      setLoaded(true); setIntakesLoaded(true); setLoading(false); setIntakesLoading(false);
      setPantryError(null); setIntakesError(null);
      setItems(next.pantry);
      setIntakes(next.intakes);
      return true;
    } catch (err) {
      if (current()) setError(actionFailure(err, "That pantry review did not save."));
      return false;
    }
  }, [api, current]);

  const run = useCallback(async (write: () => Promise<PantryEntry[]>): Promise<boolean> => {
    if (!current()) return false;
    setError(null);
    try {
      const next = await write();
      if (!current()) return false;
      ++pantryVersion.current; setLoaded(true); setLoading(false); setPantryError(null);
      setItems(next);
      return true;
    } catch (err) {
      if (current()) setError(actionFailure(err, "That didn't save."));
      return false;
    }
  }, [current]);

  return {
    items: dataClient.current === api ? items : [],
    loading: dataClient.current === api ? loading : true,
    loaded: dataClient.current === api ? loaded : false,
    pantryError: dataClient.current === api ? pantryError : null,
    error: dataClient.current === api ? error : null,
    intakes: dataClient.current === api ? intakes : [],
    intakesLoading: dataClient.current === api ? intakesLoading : true,
    intakesLoaded: dataClient.current === api ? intakesLoaded : false,
    intakesError: dataClient.current === api ? intakesError : null,
    retryPantry: () => { if (current()) { ++pantryVersion.current; setPantryAttempt(attempt => attempt + 1); } },
    retryIntakes: () => { if (current()) { ++intakesVersion.current; setIntakesAttempt(attempt => attempt + 1); } },
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
export function usePantrySearch(api = defaultApi): SearchController {
  const activeClient = useRef(api);
  activeClient.current = api;
  const dataClient = useRef(api);
  const mounted = useRef(true);
  const current = useCallback(() => mounted.current && activeClient.current === api, [api]);
  const request = useRef(0);
  const [response, setResponse] = useState<PantrySearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<ActionFailure | null>(null);
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
      if (current() && request.current === version) setError(actionFailure(err, "That search didn't work."));
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
