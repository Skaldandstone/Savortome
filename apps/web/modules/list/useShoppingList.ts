"use client";

import { useCallback, useEffect, useState } from "react";
import type { CartHandoff, CartProvider, CartProviderId, ShoppingListView } from "@seconds/core/format";
import { api } from "@/lib/client";
import { actionFailure, type ActionFailure } from "@/lib/action-failure";
import { listWithItemChecked } from "./list-state";

export interface ListController {
  list: ShoppingListView | null;
  providers: CartProvider[];
  loading: boolean;
  loaded: boolean;
  listError: ActionFailure | null;
  providersLoading: boolean;
  providersLoaded: boolean;
  providersError: ActionFailure | null;
  retryList: () => void;
  retryProviders: () => void;
  busy: boolean;
  error: ActionFailure | null;
  handoff: CartHandoff | null;
  toggle: (itemId: string, checked: boolean) => Promise<void>;
  remove: (itemId: string) => Promise<void>;
  clear: () => Promise<void>;
  addRecipes: (recipeIds: string[]) => Promise<void>;
  addItems: (items: { canonicalItem: string; displayName?: string }[]) => Promise<void>;
  sendToCart: (provider: CartProviderId) => Promise<void>;
}

export function useShoppingList(): ListController {
  const [list, setList] = useState<ShoppingListView | null>(null);
  const [providers, setProviders] = useState<CartProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [listError, setListError] = useState<ActionFailure | null>(null);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [providersLoaded, setProvidersLoaded] = useState(false);
  const [providersError, setProvidersError] = useState<ActionFailure | null>(null);
  const [listAttempt, setListAttempt] = useState(0);
  const [providersAttempt, setProvidersAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ActionFailure | null>(null);
  const [handoff, setHandoff] = useState<CartHandoff | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setListError(null);
    void (async () => {
      try {
        const nextList = await api.getList();
        if (cancelled) return;
        setList(nextList);
        setLoaded(true);
      } catch (err) {
        if (!cancelled) setListError(actionFailure(err, "Couldn't load your list."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listAttempt]);

  useEffect(() => {
    let cancelled = false;
    setProvidersLoading(true);
    setProvidersError(null);
    void (async () => {
      try {
        const nextProviders = await api.cartProviders();
        if (cancelled) return;
        setProviders(nextProviders);
        setProvidersLoaded(true);
      } catch (err) {
        if (!cancelled) setProvidersError(actionFailure(err, "Couldn't load ways to use your list."));
      } finally {
        if (!cancelled) setProvidersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [providersAttempt]);

  const run = useCallback(async (write: () => Promise<ShoppingListView>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      setList(await write());
      return true;
    } catch (err) {
      setError(actionFailure(err, "That didn't save."));
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  /** Ticking a box should feel instant; the server confirms after. */
  const toggle = useCallback(
    async (itemId: string, checked: boolean) => {
      setList((current) => listWithItemChecked(current, itemId, checked));
      const saved = await run(() => api.setListItemChecked(itemId, checked));
      if (!saved) {
        // The screen must not claim something reached the basket when the
        // server rejected the write, especially after a session expires.
        setList((current) => listWithItemChecked(current, itemId, !checked));
      }
    },
    [run],
  );

  const sendToCart = useCallback(async (provider: CartProviderId) => {
    setBusy(true);
    setError(null);
    try {
      const result = await api.sendToCart(provider);
      setHandoff(result);

      // Every provider produces text, so the clipboard is always useful.
      if (result.text && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(result.text).catch(() => {
          // Clipboard permission can be refused; the text is still on screen.
        });
      }
      if (result.url) window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(actionFailure(err, "Couldn't send that list."));
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    list,
    providers,
    loading,
    loaded,
    listError,
    providersLoading,
    providersLoaded,
    providersError,
    retryList: () => setListAttempt(current => current + 1),
    retryProviders: () => setProvidersAttempt(current => current + 1),
    busy,
    error,
    handoff,
    toggle,
    remove: async (itemId) => { await run(() => api.removeListItem(itemId)); },
    clear: async () => { await run(() => api.clearList()); },
    addRecipes: async (recipeIds) => { await run(() => api.addRecipesToList(recipeIds)); },
    addItems: async (items) => { await run(() => api.addItemsToList(items)); },
    sendToCart,
  };
}
