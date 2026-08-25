import { useCallback, useEffect, useState } from "react";
import type {
  CartHandoff,
  CartProvider,
  CartProviderId,
  ShoppingListView,
} from "@nomnom/core/format";
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
  sendToCart: (provider: CartProviderId) => Promise<CartHandoff | null>;
}

/** Same lifecycle as the web hook, over the network client. */
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
          ? { ...current, items: current.items.map((i) => (i.id === itemId ? { ...i, checked } : i)) }
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
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that list.");
      return null;
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
    sendToCart,
  };
}
