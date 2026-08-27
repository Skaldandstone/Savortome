"use client";

import { useCallback, useEffect, useState } from "react";
import type { DiscoverResponse } from "@seconds/core/format";
import { api } from "@/lib/client";

const EMPTY: DiscoverResponse = { recipes: [], tags: [], query: "", appliedTags: [] };

export interface DiscoverController {
  data: DiscoverResponse;
  loading: boolean;
  error: string | null;
  query: string;
  activeTags: string[];
  setQuery: (query: string) => void;
  search: (query: string) => Promise<void>;
  toggleTag: (tag: string) => Promise<void>;
}

export function useDiscover(): DiscoverController {
  const [data, setData] = useState<DiscoverResponse>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);

  const load = useCallback(async (nextQuery: string, nextTags: string[]) => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.discover({ query: nextQuery, tags: nextTags }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load recipes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load("", []);
  }, [load]);

  return {
    data,
    loading,
    error,
    query,
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
  };
}
