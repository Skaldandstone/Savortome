"use client";

import { useCallback, useEffect, useState } from "react";
import type { FeedItem, FriendsOverview } from "@seconds/core/format";
import { api } from "@/lib/client";

const EMPTY: FriendsOverview = { friends: [], incoming: [], outgoing: [] };

export interface FriendsController {
  overview: FriendsOverview;
  feed: FeedItem[];
  loading: boolean;
  feedLoading: boolean;
  feedLoaded: boolean;
  busy: boolean;
  error: string | null;
  overviewError: string | null;
  feedError: string | null;
  retryOverview: () => void;
  retryFeed: () => void;
  add: (handle: string) => Promise<boolean>;
  update: (personId: string, action: "accept" | "remove" | "block" | "unblock") => Promise<boolean>;
}

export function useFriends(): FriendsController {
  const [overview, setOverview] = useState<FriendsOverview>(EMPTY);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedLoaded, setFeedLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [overviewAttempt, setOverviewAttempt] = useState(0);
  const [feedAttempt, setFeedAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setOverviewError(null);
    void (async () => {
      try {
        const nextOverview = await api.friends();
        if (!cancelled) setOverview(nextOverview);
      } catch (err) {
        if (!cancelled) setOverviewError(err instanceof Error ? err.message : "Couldn't load your friends.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [overviewAttempt]);

  useEffect(() => {
    let cancelled = false;
    setFeedLoading(true);
    setFeedError(null);
    void api.feed()
      .then((nextFeed) => {
        if (cancelled) return;
        setFeed(nextFeed);
        setFeedLoaded(true);
      })
      .catch((err) => {
        if (!cancelled) setFeedError(err instanceof Error ? err.message : "Couldn't load recent activity.");
      })
      .finally(() => {
        if (!cancelled) setFeedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [feedAttempt]);

  const run = useCallback(async (write: () => Promise<FriendsOverview>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      setOverview(await write());
      // The relationship write has already succeeded. Refresh the feed as a
      // separate read so a feed outage cannot be reported as a failed write.
      setFeedAttempt((attempt) => attempt + 1);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    overview,
    feed,
    loading,
    feedLoading,
    feedLoaded,
    busy,
    error,
    overviewError,
    feedError,
    retryOverview: () => setOverviewAttempt((attempt) => attempt + 1),
    retryFeed: () => setFeedAttempt((attempt) => attempt + 1),
    add: (handle) => run(() => api.addFriend(handle)),
    update: (personId, action) => run(() => api.updateFriendship(personId, action)),
  };
}
