"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatAmount, pantryAttention, pantryPlanningItems, type PantryEntry, type SecondsClient } from "@seconds/core/format";
import { Button, Callout } from "@/ui";
import styles from "./today.module.css";

/** Optional read-only snapshot. Choosing never confirms or consumes inventory. */
export function PantryPlanningPicker({ client, disabled, onChoose }: {
  client: SecondsClient; disabled: boolean; onChoose: (item: PantryEntry) => void;
}) {
  const [items, setItems] = useState<PantryEntry[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const alive = useRef(true); const sequence = useRef(0); const reading = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; ++sequence.current; }; }, []);
  const load = async () => {
    if (reading.current || disabled) return;
    reading.current = true; const read = ++sequence.current;
    setBusy(true); setFailed(false); setItems(null);
    try { const result = await client.listPantry(); if (alive.current && sequence.current === read) setItems(result); }
    catch { if (alive.current && sequence.current === read) setFailed(true); }
    finally { if (alive.current && sequence.current === read) { reading.current = false; setBusy(false); } }
  };
  return <details className={styles.capture}>
    <summary>Check what your pantry thinks is still there</summary>
    <p>This is a saved snapshot, not a stock check. Items worth checking appear first. Choosing one only fills the meal search; it does not confirm freshness, presence or quantities.</p>
    <Button variant="ghost" disabled={disabled || busy} onClick={() => void load()}>{busy ? "Loading pantry choices…" : items !== null ? "Refresh pantry choices" : "Check my pantry"}</Button>
    {busy ? <p role="status">Checking your saved pantry…</p> : null}
    {failed ? <Callout tone="error" role="alert">Pantry choices could not load. Try again; an empty view does not mean your pantry was cleared. You can still type a temporary ingredient above.</Callout> : null}
    {items?.length === 0 ? <p>No saved pantry items. You can type a temporary ingredient above or add items in <Link href="/cook">your pantry</Link>.</p> : null}
    {items && items.length > 0 ? <>
      <p>Showing {Math.min(items.length, 6)} of {items.length} saved items. <Link href="/cook">Open the pantry to check or correct amounts</Link>.</p>
      {pantryPlanningItems(items).map(item => {
        const attention = pantryAttention(item); const amount = formatAmount(item);
        return <div className={styles.idea} key={item.canonicalItem}>
          <strong>{item.displayName}</strong><p>Saved amount: {amount || "not recorded"}. Not verified now.</p>
          {attention?.shouldResurface ? <p>{attention.message}</p> : null}
          {item.confidence === "needs_review" ? <p>This record still needs your review in the pantry.</p> : null}
          <Button variant="ghost" disabled={disabled || busy || item.canonicalItem.length > 200} onClick={() => onChoose(item)}>Use {item.displayName} for meal ideas</Button>
        </div>;
      })}
    </> : null}
  </details>;
}
