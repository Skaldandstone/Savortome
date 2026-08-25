import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import type { GroceryStore, KrogerStatus } from "@nomnom/core/format";
import { api } from "@/lib/client";
import { apiBaseUrl } from "@/lib/api";
import {
  Button,
  Callout,
  Field,
  Panel,
  radius,
  space,
  type as typeScale,
  usePalette,
} from "@/ui";

/**
 * Connecting a Kroger account, and choosing which store the cart belongs to.
 *
 * The sign-in itself happens on the web.
 *
 * Kroger's OAuth redirect lands on our server, and the server identifies a
 * mobile caller by a bearer token that a system browser doesn't carry — so a
 * sign-in started here would come back as nobody. Rather than smuggle a token
 * through a URL, this opens the web app, where the session is a cookie and the
 * round trip just works. Everything after that — picking a store, sending the
 * list — happens here.
 */
export function KrogerConnection() {
  const [status, setStatus] = useState<KrogerStatus | null>(null);
  const [zipCode, setZipCode] = useState("");
  const [stores, setStores] = useState<GroceryStore[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const c = usePalette();

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

  // Nothing to show at all when the server has no Kroger credentials.
  if (!status?.configured) return null;

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel style={styles.panel}>
      <Text style={[styles.heading, { color: c.textMuted }]}>KROGER / FRED MEYER</Text>

      {!status.connected ? (
        <>
          <Text style={[styles.note, { color: c.textMuted }]}>
            Kroger writes to your own cart, so it needs you to sign in to them once — on the web,
            then come back.
          </Text>
          <View style={styles.actions}>
            <Button
              label="Connect on the web"
              onPress={() => {
                void WebBrowser.openBrowserAsync(`${apiBaseUrl()}/list`);
              }}
            />
            <Button label="Check again" variant="ghost" onPress={() => void load()} />
          </View>
        </>
      ) : (
        <>
          <Text style={[styles.note, { color: c.textMuted }]}>
            {status.store
              ? `Connected — your cart is at ${status.store.name}.`
              : "Connected. Pick a store: prices and stock differ between them."}
          </Text>

          {!status.store || stores ? (
            <>
              <View style={styles.search}>
                <Field
                  value={zipCode}
                  placeholder="ZIP code"
                  keyboardType="number-pad"
                  accessibilityLabel="ZIP code"
                  style={styles.zip}
                  onChangeText={setZipCode}
                />
                <Button
                  label="Find stores"
                  disabled={busy || !zipCode.trim()}
                  onPress={() =>
                    void run(async () => setStores(await api.krogerStores(zipCode.trim())))
                  }
                />
              </View>

              {stores?.length === 0 ? (
                <Text style={[styles.note, { color: c.textMuted }]}>
                  No Kroger-family stores near there.
                </Text>
              ) : null}

              {stores?.map((store) => (
                <Pressable
                  key={store.locationId}
                  disabled={busy}
                  accessibilityRole="button"
                  onPress={() =>
                    void run(async () => {
                      setStatus(await api.setKrogerStore(store));
                      setStores(null);
                    })
                  }
                  style={[styles.store, { backgroundColor: c.surfaceSunken, borderColor: c.border }]}
                >
                  <Text style={{ color: c.text, fontWeight: "600", fontSize: typeScale.body }}>
                    {store.name}
                  </Text>
                  {store.address ? (
                    <Text style={{ color: c.textMuted, fontSize: typeScale.small }}>
                      {store.address}
                    </Text>
                  ) : null}
                </Pressable>
              ))}
            </>
          ) : (
            <View style={styles.actions}>
              <Button label="Change store" variant="ghost" onPress={() => setStores([])} />
              <Button
                label="Disconnect"
                variant="ghost"
                disabled={busy}
                onPress={() =>
                  void run(async () => {
                    setStatus(await api.disconnectKroger());
                    setStores(null);
                  })
                }
              />
            </View>
          )}
        </>
      )}

      {error ? <Callout tone="error">{error}</Callout> : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  panel: { padding: space.lg, gap: space.sm },
  heading: { fontSize: typeScale.micro, letterSpacing: 1, fontWeight: "600" },
  note: { fontSize: typeScale.small, lineHeight: 19 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.xs },
  search: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.xs },
  zip: { flex: 1 },
  store: { padding: space.md, borderWidth: 1, borderRadius: radius.sm, gap: 2 },
});
