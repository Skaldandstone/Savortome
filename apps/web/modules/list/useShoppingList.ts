"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isUuid, type CartHandoff, type CartProvider, type CartProviderId, type ShoppingListView } from "@seconds/core/format";
import { api as localApi } from "@/lib/client";
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

/** Admit only the selected provider's response before any browser side effect. */
function confirmedHandoff(value: CartHandoff, provider: CartProviderId): boolean {
  if (!value || value.provider !== provider || typeof value.text !== "string" ||
    typeof value.note !== "string" || typeof value.url !== "string" ||
    !Array.isArray(value.unmatched) || !value.unmatched.every(item => typeof item === "string")) return false;
  const expectedKind = provider === "instacart" || provider === "kroger" ? "api" : "handoff";
  if (value.kind !== expectedKind) return false;
  if (provider === "clipboard") return value.url === "";
  if (value.url !== value.url.trim() || /[\\\u0000-\u0020]/.test(value.url)) return false;
  try {
    const url = new URL(value.url);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.hash) return false;
    switch (provider) {
      // Other returned domains need explicit provider review before admission.
      case "instacart": return url.hostname === "instacart.com" || url.hostname.endsWith(".instacart.com");
      case "kroger": return url.hostname === "www.kroger.com" && url.pathname === "/cart" && !url.search;
      case "doordash": return url.hostname === "www.doordash.com" && url.pathname === "/convenience/" && !url.search;
      case "ubereats": return url.hostname === "www.ubereats.com" && url.pathname === "/category/grocery" && !url.search;
      case "safeway": return url.hostname === "www.safeway.com" && url.pathname === "/shop/search-results.html" &&
        [...url.searchParams.keys()].every(key => key === "q");
      default: return false;
    }
  } catch { return false; }
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

export function useShoppingList(api: typeof localApi = localApi): ListController {
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
  const activeClient = useRef(api); activeClient.current = api;
  const dataClient = useRef(api);
  const providersClient = useRef(api);
  const current = () => alive.current && activeClient.current === api;

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);


  useEffect(() => {
    let cancelled = false;
    reading.current = true;
    ready.current = false; action.current = false;
    setBusy(false); setError(null); setHandoff(null);
    setLoading(true);
    setListError(null);
    void (async () => {
      try {
        const nextList = await api.getList();
        if (cancelled || !current()) return;
        if (!confirmedList(nextList)) throw new Error("Unconfirmed list");
        dataClient.current = api;
        ready.current = true;
        setList(nextList);
        setLoaded(true);
      } catch (err) {
        if (!cancelled && current()) {
          if (dataClient.current !== api) { dataClient.current = api; setList(null); setLoaded(false); }
          ready.current = false; setListError(actionFailure(err, "Couldn't load your list.")); }
      } finally {
        if (!cancelled && current()) { reading.current = false; setLoading(false); }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, listAttempt]);

  useEffect(() => {
    let cancelled = false;
    setProvidersLoading(true);
    setProvidersError(null);
    void (async () => {
      try {
        const nextProviders = await api.cartProviders();
        if (cancelled || !current()) return;
        providersClient.current = api;
        setProviders(nextProviders);
        setProvidersLoaded(true);
      } catch (err) {
        if (!cancelled && current()) {
          if (providersClient.current !== api) { providersClient.current = api; setProviders([]); setProvidersLoaded(false); }
          setProvidersError(actionFailure(err, "Couldn't load ways to use your list."));
        }
      } finally {
        if (!cancelled && current()) setProvidersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, providersAttempt]);

  const run = useCallback(async (write: () => Promise<ShoppingListView>): Promise<boolean> => {
    if (!current() || dataClient.current !== api || action.current || reading.current || !ready.current) return false;
    action.current = true;
    setBusy(true);
    setError(null);
    setHandoff(null);
    try {
      const next = await write();
      if (!current()) return false;
      if (!confirmedList(next)) throw new Error("Unconfirmed list");
      setList(next);
      return true;
    } catch (err) {
      if (current()) setError({ ...actionFailure(err, ""), message: "This change is unconfirmed and may still finish. Review your list before trying again; nothing retries automatically." });
      return false;
    } finally {
      if (current()) { action.current = false; setBusy(false); }
    }
  }, [api]);

  /** Keep the last confirmed checkbox and counts together until the response. */
  const toggle = useCallback(async (itemId: string, checked: boolean) => {
    await run(() => api.setListItemChecked(itemId, checked));
  }, [run]);

  const sendToCart = useCallback(async (provider: CartProviderId) => {
    if (!current() || dataClient.current !== api || action.current || reading.current || !ready.current) return;
    action.current = true;
    setBusy(true);
    setError(null);
    setHandoff(null);
    try {
      const result = await api.sendToCart(provider);
      if (!current()) return;
      if (!confirmedHandoff(result, provider)) throw new Error("Unconfirmed handoff");
      setHandoff(result);

      // Every provider produces text, so the clipboard is always useful.
      if (result.text && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(result.text).catch(() => {
          // Clipboard permission can be refused; the text is still on screen.
        });
      }
      if (current() && result.url) window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      if (current()) setError({ ...actionFailure(err, ""), message: "Couldn't confirm that list handoff. Check before trying again." });
    } finally {
      if (current()) { action.current = false; setBusy(false); }
    }
  }, [api]);

  const scoped = dataClient.current === api;
  const scopedProviders = providersClient.current === api;
  return {
    list: scoped ? list : null,
    providers: scopedProviders ? providers : [],
    loading: !scoped || loading,
    loaded: scoped && loaded,
    listError: scoped ? listError : null,
    providersLoading: !scopedProviders || providersLoading,
    providersLoaded: scopedProviders && providersLoaded,
    providersError: scopedProviders ? providersError : null,
    retryList: () => {
      if (!current() || action.current || reading.current) return;
      reading.current = true;
      setListAttempt(current => current + 1);
    },
    retryProviders: () => { if (current()) setProvidersAttempt(current => current + 1); },
    busy: !scoped || busy || loading || !ready.current,
    error: scoped ? error : null,
    handoff: scoped ? handoff : null,
    toggle,
    remove: async (itemId) => { await run(() => api.removeListItem(itemId)); },
    clear: async () => { await run(() => api.clearList()); },
    addRecipes: async (recipeIds) => { await run(() => api.addRecipesToList(recipeIds)); },
    addItems: async (items) => { await run(() => api.addItemsToList(items)); },
    sendToCart,
  };
}
