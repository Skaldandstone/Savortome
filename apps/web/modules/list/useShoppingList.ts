"use client";

import { useCallback, useEffect, useState } from "react";
import type { CartHandoff, CartProvider, CartProviderId, ShoppingListView } from "@seconds/core/format";
import { api } from "@/lib/client";

export interface ListController {
  list: ShoppingListView | null;
  providers: CartProvider[];
  loading: boolean;
  busy: boolean;
  error: string | null;
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handoff, setHandoff] = useState<CartHandoff | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [nextList, nextProviders] = await Promise.all([api.getList(), api.cartProviders()]);
        if (cancelled) return;
        setList(nextList);
        setProviders(nextProviders);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load your list.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const run = useCallback(async (write: () => Promise<ShoppingListView>) => {
    setBusy(true);
    setError(null);
    try {
      setList(await write());
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't save.");
    } finally {
      setBusy(false);
    }
  }, []);

  /** Ticking a box should feel instant; the server confirms after. */
  const toggle = useCallback(
    async (itemId: string, checked: boolean) => {
      setList((current) =>
        current
          ? {
              ...current,
              items: current.items.map((i) => (i.id === itemId ? { ...i, checked } : i)),
            }
          : current,
      );
      await run(() => api.setListItemChecked(itemId, checked));
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
      setError(err instanceof Error ? err.message : "Couldn't send that list.");
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    list,
    providers,
    loading,
    busy,
    error,
    handoff,
    toggle,
    remove: (itemId) => run(() => api.removeListItem(itemId)),
    clear: () => run(() => api.clearList()),
    addRecipes: (recipeIds) => run(() => api.addRecipesToList(recipeIds)),
    addItems: (items) => run(() => api.addItemsToList(items)),
    sendToCart,
  };
}
