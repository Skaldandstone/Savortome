"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { GroceryStore, KrogerStatus } from "@seconds/core/format";
import { api as localApi } from "@/lib/client";
import { Button, Callout, TextField } from "@/ui";
import styles from "./list.module.css";

function confirmedStore(value: GroceryStore): boolean {
  return !!value && typeof value.locationId === "string" && !!value.locationId.trim() &&
    typeof value.name === "string" && (value.address === undefined || typeof value.address === "string") &&
    (value.chain === undefined || typeof value.chain === "string");
}
function confirmedStatus(value: KrogerStatus): boolean {
  return !!value && typeof value.configured === "boolean" && typeof value.connected === "boolean" &&
    (value.store === null || confirmedStore(value.store));
}

/**
 * Connecting a Kroger account, and choosing which store the cart belongs to.
 *
 * Kroger is the only provider here that writes to a cart the shopper already
 * owns, which is why it's the only one that needs any of this: a sign-in, and
 * then a store, because price, stock, and even what's carried differ between
 * one Fred Meyer and the next.
 */
export function KrogerConnection({ api = localApi }: { api?: typeof localApi }) {
  const [status, setStatus] = useState<KrogerStatus | null>(null);
  const [zipCode, setZipCode] = useState("");
  const [stores, setStores] = useState<GroceryStore[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const params = useSearchParams();
  const returned = params.get("kroger");

  const alive = useRef(true);
  const activeClient = useRef(api); activeClient.current = api;
  const dataClient = useRef(api);
  const action = useRef(false);
  const ready = useRef(false);
  const current = () => alive.current && activeClient.current === api;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const load = useCallback(async () => {
    if (!current() || action.current) return;
    action.current = true; ready.current = false;
    setBusy(true); setError(null);
    try {
      const next = await api.krogerStatus();
      if (!current()) return;
      if (!confirmedStatus(next)) throw new Error("Unconfirmed connection");
      dataClient.current = api; setStatus(next); ready.current = true;
    } catch {
      if (current()) {
        if (dataClient.current !== api) { dataClient.current = api; setStatus(null); }
        setError("Couldn't confirm your Kroger connection. Check again before making changes.");
      }
    } finally {
      if (current()) { action.current = false; setBusy(false); }
    }
  }, [api]);

  useEffect(() => {
    action.current = false; ready.current = false;
    setStatus(null); setStores(null); setZipCode(""); setError(null);
    void load();
  }, [api, load]);

  const change = async (write: () => Promise<void>, failure: string) => {
    if (!current() || dataClient.current !== api || !ready.current || action.current) return;
    action.current = true; setBusy(true); setError(null);
    try { await write(); }
    catch { if (current()) { ready.current = false; setError(failure); } }
    finally { if (current()) { action.current = false; setBusy(false); } }
  };
  const findStores = () => change(async () => {
    const next = await api.krogerStores(zipCode.trim());
    if (!current()) return;
    if (!Array.isArray(next) || !next.every(confirmedStore)) throw new Error("Unconfirmed stores");
    setStores(next);
  }, "Couldn't confirm stores. Check your connection before trying again.");
  const chooseStore = (store: GroceryStore) => change(async () => {
    const next = await api.setKrogerStore(store);
    if (!current()) return;
    if (!confirmedStatus(next) || !next.connected || next.store?.locationId !== store.locationId) throw new Error("Unconfirmed connection");
    setStatus(next); setStores(null);
  }, "Your store change is unconfirmed and may still finish. Check your connection before trying again.");
  const disconnect = () => change(async () => {
    const next = await api.disconnectKroger();
    if (!current()) return;
    if (!confirmedStatus(next) || next.connected || next.store !== null) throw new Error("Unconfirmed connection");
    setStatus(next); setStores(null);
  }, "Disconnecting is unconfirmed and may still finish. Check your connection before trying again.");

  if (dataClient.current !== api) return null;
  if (!status?.configured) return error ? <Callout tone="error" role="alert">{error} <Button type="button" disabled={busy} onClick={() => void load()}>Check connection again</Button></Callout> : null;

  return (
    <div className={styles.kroger}>
      <h3 className={styles.cartHeading}>Kroger / Fred Meyer</h3>

      {returned === "declined" ? (
        <Callout tone="info">You didn&apos;t finish signing in to Kroger.</Callout>
      ) : returned === "mismatch" ? (
        <Callout tone="error">
          That sign-in didn&apos;t come back the way it left, so it was ignored. Try again.
        </Callout>
      ) : null}

      {!status.connected ? (
        <>
          <p className={styles.cartNote}>
            Kroger writes to your own cart, so it needs you to sign in to them once.
          </p>
          {/* A plain link, not a fetch: the browser has to follow the redirect
              to Kroger and carry back the cookie holding the state. */}
          <a className={styles.connect} href="/api/grocery/kroger/connect">
            Connect Kroger
          </a>
        </>
      ) : (
        <>
          <p className={styles.cartNote}>
            {status.store
              ? `Connected — your cart is at ${status.store.name}.`
              : "Connected. Pick a store: prices and stock differ between them."}
          </p>

          {!status.store || stores ? (
            <>
              <div className={styles.storeSearch}>
                <TextField
                  value={zipCode}
                  inputMode="numeric"
                  placeholder="ZIP code"
                  aria-label="ZIP code"
                  onChange={(e) => { if (current()) setZipCode(e.target.value); }}
                />
                <Button type="button" disabled={busy || !ready.current || !zipCode.trim()} onClick={() => void findStores()}>
                  Find stores
                </Button>
              </div>

              {stores?.length === 0 ? (
                <p className={styles.cartNote}>No Kroger-family stores near there.</p>
              ) : null}

              <ul className={styles.storeList}>
                {stores?.map((store) => (
                  <li key={store.locationId}>
                    <button
                      type="button"
                      className={styles.store}
                      disabled={busy || !ready.current}
                      onClick={() => void chooseStore(store)}
                    >
                      <strong>{store.name}</strong>
                      {store.address ? <span>{store.address}</span> : null}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className={styles.krogerActions}>
              <Button type="button" variant="ghost" disabled={busy || !ready.current} onClick={() => { if (current() && ready.current && !action.current) setStores([]); }}>
                Change store
              </Button>
              <Button type="button" variant="ghost" disabled={busy || !ready.current} onClick={() => void disconnect()}>
                Disconnect
              </Button>
            </div>
          )}
        </>
      )}

      {error ? (
        <Callout tone="error" role="alert">
          {error}{" "}<Button type="button" disabled={busy} onClick={() => void load()}>Check connection again</Button>
        </Callout>
      ) : null}
    </div>
  );
}
