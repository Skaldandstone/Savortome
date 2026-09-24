"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DiscoverResponse } from "@seconds/core/format";
import { api } from "@/lib/client";

const EMPTY: DiscoverResponse = { recipes: [], tags: [], query: "", appliedTags: [] };

export interface DiscoverController {
  data: DiscoverResponse;
  loading: boolean;
  loaded: boolean;
  error: string | null;
  query: string;
  /**
   * The last query actually searched for, as opposed to what is in the box
   * right now. Tracked here rather than read back off the response so that a
   * failed request still knows what was asked — the fallbacks shown on an
   * empty result need it most exactly when the server call didn't work.
   */
  searchedQuery: string;
  activeTags: string[];
  setQuery: (query: string) => void;
  search: (query: string) => Promise<void>;
  toggleTag: (tag: string) => Promise<void>;
  retry: () => Promise<void>;
}

export function useDiscover(): DiscoverController {
  const [data, setData] = useState<DiscoverResponse>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const request = useRef(0);

  const load = useCallback(async (nextQuery: string, nextTags: string[]) => {
    const version = ++request.current;
    setLoading(true);
    setError(null);
    setSearchedQuery(nextQuery);
    try {
      const next = await api.discover({ query: nextQuery, tags: nextTags });
      if (version !== request.current) return;
      setData(next);
      setLoaded(true);
    } catch (err) {
      if (version !== request.current) return;
      setError(err instanceof Error ? err.message : "Couldn't load recipes.");
    } finally {
      if (version === request.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load("", []);
    return () => { request.current += 1; };
  }, [load]);

  return {
    data,
    loading,
    loaded,
    error,
    query,
    searchedQuery,
    activeTags,
    setQuery,
    search: (next) => {
      setQuery(next);
      return load(next, activeTags);
    },
    toggleTag: (tag) => {
      // Tags stack: picking two narrows to recipes carrying either.
      const next = activeTags.includes(tag)
        ? activeTags.filter((t) => t !== tag)
        : [...activeTags, tag];
      setActiveTags(next);
      return load(query, next);
    },
    retry: () => load(searchedQuery, activeTags),
  };
}
