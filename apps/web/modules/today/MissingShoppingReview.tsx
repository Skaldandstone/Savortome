"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { mealShoppingNames, type SecondsClient } from "@seconds/core/format";
import { Button, Callout, FieldRow } from "@/ui";

export function MissingShoppingReview({ missing, client, onPending }: { missing: string[]; client: SecondsClient; onPending: (pending: boolean) => void }) {
  const [names] = useState(() => mealShoppingNames(missing));
  const [selected, setSelected] = useState(names);
  const [pending, setPending] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const alive = useRef(true); const action = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  if (!names.length) return null;
  const save = async () => {
    if (action.current || done || !selected.length) return;
    action.current = true; setBusy(true); setMessage("");
    const exact = pending ?? [...selected]; setPending(exact); onPending(true);
    try {
      await client.addItemsToList(exact.map(canonicalItem => ({ canonicalItem, displayName: canonicalItem })));
      if (alive.current) { setDone(true); setPending(null); onPending(false); setMessage("Selected names added to your list. Existing amounts and check marks were kept. Pantry and meal plans were not changed."); }
    } catch { if (alive.current) setMessage("We could not confirm the list update. It may already have saved. Your exact selection is kept; retry it or check your list before changing anything."); }
    finally { if (alive.current) { action.current = false; setBusy(false); } }
  };
  return <details><summary>Review missing items for my list</summary>
    <p>Choose the names to add. No quantities are inferred. Staples and optional ingredients are not included in these missing-name suggestions; check the full recipe too. This does not order groceries.</p>
    <fieldset disabled={busy || pending !== null || done}><legend>Missing ingredient names</legend>
      {names.map(name => <label key={name}><input type="checkbox" checked={selected.includes(name)} onChange={event => setSelected(current => event.target.checked ? [...current, name] : current.filter(item => item !== name))} />{name}</label>)}
    </fieldset>
    <FieldRow><Button disabled={busy || done || !selected.length} onClick={() => void save()}>{busy ? "Updating list…" : pending ? `Retry the same ${pending.length} names` : `Add ${selected.length} selected names to my list`}</Button><Link href="/list">Check my shopping list</Link></FieldRow>
    {pending ? <><p>The result is unconfirmed. Changing meal ideas is paused to keep this selection. Leaving Today loses this local retry state; check your list when you return.</p><Button variant="ghost" disabled={busy} onClick={() => { if (window.confirm("Discard the local retry selection? The earlier list update may already have saved. This does not undo it.")) { setPending(null); onPending(false); setMessage("Local retry state discarded. Check your list before adding anything again."); } }}>Discard local retry state</Button></> : null}
    {message ? <Callout tone={done ? "info" : "error"} role="status">{message}</Callout> : null}
  </details>;
}
