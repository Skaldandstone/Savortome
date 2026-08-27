"use client";

import { useCallback, useEffect, useState } from "react";
import type { FeedItem, FriendsOverview } from "@seconds/core/format";
import { api } from "@/lib/client";

const EMPTY: FriendsOverview = { friends: [], incoming: [], outgoing: [] };

export interface FriendsController {
  overview: FriendsOverview;
  feed: FeedItem[];
  loading: boolean;
  busy: boolean;
  error: string | null;
  add: (handle: string) => Promise<void>;
  update: (personId: string, action: "accept" | "remove" | "block" | "unblock") => Promise<void>;
}

export function useFriends(): FriendsController {
  const [overview, setOverview] = useState<FriendsOverview>(EMPTY);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [nextOverview, nextFeed] = await Promise.all([api.friends(), api.feed()]);
        if (cancelled) return;
        setOverview(nextOverview);
        setFeed(nextFeed);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load your friends.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const run = useCallback(async (write: () => Promise<FriendsOverview>) => {
    setBusy(true);
    setError(null);
    try {
      setOverview(await write());
      // Accepting a request changes whose activity you can see, so the feed
      // is refetched rather than left showing the old set.
      setFeed(await api.feed());
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    overview,
    feed,
    loading,
    busy,
    error,
    add: (handle) => run(() => api.addFriend(handle)),
    update: (personId, action) => run(() => api.updateFriendship(personId, action)),
  };
}
