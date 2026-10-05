"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatAmount, pantryAttention, pantryPlanningMatches, type PantryEntry, type SecondsClient } from "@seconds/core/format";
import { Button, Callout, TextField } from "@/ui";
import styles from "./today.module.css";

/** Optional read-only snapshot. Choosing never confirms or consumes inventory. */
export function PantryPlanningPicker({ client, disabled, onChoose }: {
  client: SecondsClient; disabled: boolean; onChoose: (item: PantryEntry) => void;
}) {
  const [items, setItems] = useState<PantryEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState(""); const [shown, setShown] = useState(6);
  const alive = useRef(true); const sequence = useRef(0); const reading = useRef(false);
  const activeClient = useRef(client); activeClient.current = client;
  const dataClient = useRef(client);
  const blocked = useRef(disabled); blocked.current = disabled;
  const current = () => alive.current && activeClient.current === client;
  const choiceVersion = sequence.current;
  const canChoose = () => current() && !blocked.current && !reading.current && dataClient.current === client && sequence.current === choiceVersion;
  useEffect(() => { alive.current = true; dataClient.current = client; ++sequence.current; reading.current = false; setBusy(false); setItems(null); setFailed(false); setQuery(""); setShown(6); return () => { alive.current = false; ++sequence.current; }; }, [client]);
  const load = async () => {
    if (reading.current || blocked.current || !current()) return;
    reading.current = true; const read = ++sequence.current;
    setBusy(true); setFailed(false); setItems(null); setQuery(""); setShown(6);
    try { const result = await client.listPantry(); if (current() && sequence.current === read) setItems(result); }
    catch { if (current() && sequence.current === read) setFailed(true); }
    finally { if (current() && sequence.current === read) { reading.current = false; setBusy(false); } }
  };
  const snapshot = dataClient.current === client ? items : null;
  const matches = snapshot ? pantryPlanningMatches(snapshot, query) : [];
  return <details className={styles.capture}>
    <summary>Check what your pantry thinks is still there</summary>
    <p>This is a saved snapshot, not a stock check. Items worth checking appear first. Choosing one only fills the meal search; it does not confirm freshness, presence or quantities.</p>
    <Button variant="ghost" aria-busy={busy} disabled={disabled || busy} onClick={() => void load()}>{busy ? "Loading pantry choices…" : snapshot !== null ? "Refresh pantry choices" : "Check my pantry"}</Button>
    {busy ? <p role="status">Checking your saved pantry…</p> : null}
    {failed ? <Callout tone="error" role="alert">Pantry choices could not load. Try again; an empty view does not mean your pantry was cleared. You can still type a temporary ingredient above.</Callout> : null}
    {snapshot?.length === 0 ? <p>No saved pantry items. You can type a temporary ingredient above or add items in <Link href="/cook">your pantry</Link>.</p> : null}
    {snapshot && snapshot.length > 0 ? <>
      <label>Find a saved pantry name<TextField type="search" value={query} maxLength={100} placeholder="For example, bananas" disabled={disabled || busy} onChange={event => { if (canChoose()) { setQuery(event.target.value); setShown(6); } }} /></label>
      <p>Search checks saved display names and ingredient keys on this screen only. It does not send the words to a provider or change your pantry. Brand aliases and unsaved foods may not match.</p>
      <p role="status">Showing {Math.min(matches.length, shown)} of {matches.length} matching saved items ({snapshot.length} saved in total).</p>
      {matches.length === 0 ? <p>No saved name matches this search. Clear it or type a temporary meal ingredient above. This does not mean the food is absent from your kitchen.</p> : null}
      {query ? <Button variant="ghost" disabled={disabled || busy} onClick={() => { if (canChoose()) { setQuery(""); setShown(6); } }}>Clear pantry name search</Button> : null}
      <p><Link href="/cook">Open the pantry to check or correct amounts</Link>.</p>
      {matches.slice(0, shown).map(item => {
        const attention = pantryAttention(item); const amount = formatAmount(item);
        return <div className={styles.idea} key={item.canonicalItem}>
          <strong>{item.displayName}</strong><p>Saved amount: {amount || "not recorded"}. Not verified now.</p>
          {attention?.shouldResurface ? <p>{attention.message}</p> : null}
          {item.confidence === "needs_review" ? <p>This record still needs your review in the pantry.</p> : null}
          <Button variant="ghost" disabled={disabled || busy || item.canonicalItem.length > 200} onClick={() => { if (canChoose()) onChoose(item); }}>Use {item.displayName} for meal ideas</Button>
        </div>;
      })}
      {matches.length > shown ? <Button variant="ghost" disabled={disabled || busy} onClick={() => { if (canChoose()) setShown(value => value + 6); }}>Show six more pantry items</Button> : null}
    </> : null}
  </details>;
}
