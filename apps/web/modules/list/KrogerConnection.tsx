"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { GroceryStore, KrogerStatus } from "@nomnom/core/format";
import { api } from "@/lib/client";
import { Button, Callout, TextField } from "@/ui";
import styles from "./list.module.css";

/**
 * Connecting a Kroger account, and choosing which store the cart belongs to.
 *
 * Kroger is the only provider here that writes to a cart the shopper already
 * owns, which is why it's the only one that needs any of this: a sign-in, and
 * then a store, because price, stock, and even what's carried differ between
 * one Fred Meyer and the next.
 */
export function KrogerConnection() {
  const [status, setStatus] = useState<KrogerStatus | null>(null);
  const [zipCode, setZipCode] = useState("");
  const [stores, setStores] = useState<GroceryStore[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const params = useSearchParams();
  const returned = params.get("kroger");

  const load = useCallback(async () => {
    try {
      setStatus(await api.krogerStatus());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't check your Kroger connection.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Nothing to show at all when the server has no Kroger credentials — an
  // empty box inviting you to connect to something that can't work is worse
  // than no box.
  if (!status?.configured) return null;

  const findStores = async () => {
    setBusy(true);
    setError(null);
    try {
      setStores(await api.krogerStores(zipCode.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't look up stores.");
    } finally {
      setBusy(false);
    }
  };

  const chooseStore = async (store: GroceryStore) => {
    setBusy(true);
    try {
      setStatus(await api.setKrogerStore(store));
      setStores(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't set that store.");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      setStatus(await api.disconnectKroger());
      setStores(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't disconnect.");
    } finally {
      setBusy(false);
    }
  };

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
                  onChange={(e) => setZipCode(e.target.value)}
                />
                <Button type="button" disabled={busy || !zipCode.trim()} onClick={() => void findStores()}>
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
                      disabled={busy}
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
              <Button type="button" variant="ghost" disabled={busy} onClick={() => setStores([])}>
                Change store
              </Button>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => void disconnect()}>
                Disconnect
              </Button>
            </div>
          )}
        </>
      )}

      {error ? (
        <Callout tone="error" role="alert">
          {error}
        </Callout>
      ) : null}
    </div>
  );
}
