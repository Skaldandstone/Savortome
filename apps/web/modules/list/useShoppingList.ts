"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isUuid, type CartHandoff, type CartProvider, type CartProviderId, type ShoppingListView } from "@seconds/core/format";
import { api } from "@/lib/client";
import { actionFailure, type ActionFailure } from "@/lib/action-failure";

function confirmedList(value: ShoppingListView): boolean {
  return !!value && isUuid(value.id) && Array.isArray(value.items) &&
    Number.isInteger(value.itemCount) && value.itemCount === value.items.length &&
    Number.isInteger(value.checkedCount) && value.checkedCount === value.items.filter(item => item?.checked === true).length &&
    value.items.every(item => !!item && isUuid(item.id) && typeof item.canonicalItem === "string" && !!item.canonicalItem.trim() &&
      typeof item.displayName === "string" && typeof item.checked === "boolean" &&
      (item.quantity === null || (typeof item.quantity === "number" && Number.isFinite(item.quantity))) &&
      (item.unit === null || typeof item.unit === "string") && Array.isArray(item.recipeIds) && item.recipeIds.every(isUuid));
}

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
  const alive = useRef(true);
  const action = useRef(false);
  const reading = useRef(true);
  const ready = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);


  useEffect(() => {
    let cancelled = false;
    reading.current = true;
    setLoading(true);
    setListError(null);
    void (async () => {
      try {
        const nextList = await api.getList();
        if (cancelled) return;
        if (!confirmedList(nextList)) throw new Error("Unconfirmed list");
        ready.current = true;
        setList(nextList);
        setLoaded(true);
      } catch (err) {
        if (!cancelled) { ready.current = false; setListError(actionFailure(err, "Couldn't load your list.")); }
      } finally {
        if (!cancelled) { reading.current = false; setLoading(false); }
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
    if (!alive.current || action.current || reading.current || !ready.current) return false;
    action.current = true;
    setBusy(true);
    setError(null);
    setHandoff(null);
    try {
      const next = await write();
      if (!alive.current) return false;
      if (!confirmedList(next)) throw new Error("Unconfirmed list");
      setList(next);
      return true;
    } catch (err) {
      if (alive.current) setError({ ...actionFailure(err, ""), message: "This change is unconfirmed and may still finish. Review your list before trying again; nothing retries automatically." });
      return false;
    } finally {
      action.current = false;
      if (alive.current) setBusy(false);
    }
  }, []);

  /** Keep the last confirmed checkbox and counts together until the response. */
  const toggle = useCallback(async (itemId: string, checked: boolean) => {
    await run(() => api.setListItemChecked(itemId, checked));
  }, [run]);

  const sendToCart = useCallback(async (provider: CartProviderId) => {
    if (!alive.current || action.current || reading.current || !ready.current) return;
    action.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await api.sendToCart(provider);
      if (!alive.current) return;
      setHandoff(result);

      // Every provider produces text, so the clipboard is always useful.
      if (result.text && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(result.text).catch(() => {
          // Clipboard permission can be refused; the text is still on screen.
        });
      }
      if (alive.current && result.url) window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      if (alive.current) setError({ ...actionFailure(err, ""), message: "Couldn't confirm that list handoff. Check before trying again." });
    } finally {
      action.current = false;
      if (alive.current) setBusy(false);
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
    retryList: () => {
      if (!alive.current || action.current || reading.current) return;
      reading.current = true;
      setListAttempt(current => current + 1);
    },
    retryProviders: () => { if (alive.current) setProvidersAttempt(current => current + 1); },
    busy: busy || loading || !ready.current,
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
