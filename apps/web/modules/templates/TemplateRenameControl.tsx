"use client";

import { useEffect, useId, useRef, useState } from "react";
import { parseMealTemplateRename, type MealTemplateRenameInput, type SecondsClient } from "@seconds/core/format";
import { Button, TextField } from "@/ui";
import styles from "./templates.module.css";

/** Names only: recipes, access, planning and pantry quantities are unchanged. */
export function TemplateRenameControl({ templateId, name, client, disabled, onPending, onConfirmed, onReview }: {
  templateId: string; name: string; client: SecondsClient; disabled: boolean;
  onPending: (pending: boolean) => void;
  onConfirmed: (name: string) => void;
  onReview: () => void;
}) {
  const fieldId = useId(); const hintId = useId(); const openerId = useId();
  const restoreFocus = useRef(false);
  const alive = useRef(true); const action = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(name);
  const [pending, setPending] = useState<MealTemplateRenameInput | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!open && restoreFocus.current) {
      restoreFocus.current = false;
      document.getElementById(openerId)?.focus();
    }
  }, [open, openerId]);

  async function save() {
    if (action.current || (disabled && !pending)) return;
    let exact: MealTemplateRenameInput;
    try { exact = pending ?? parseMealTemplateRename({ previousName: name, name: draft }); }
    catch { setMessage("Enter a name of one to 160 characters, without control characters."); return; }
    if (!pending && exact.name === name) { setMessage("This is already the saved name."); return; }
    action.current = true; setBusy(true); setPending(exact); onPending(true); setMessage("");
    try {
      const result = await client.renameTemplate(templateId, exact);
      if (result.confirmed?.id !== templateId || result.confirmed.name !== exact.name) throw new Error("Unconfirmed");
      if (!alive.current) return;
      onConfirmed(exact.name); onPending(false); setPending(null); restoreFocus.current = true; setOpen(false);
      setMessage("Meal name saved. Its dishes and sharing settings have not changed.");
    } catch {
      if (alive.current) setMessage("We could not confirm this name. It may already be saved, or the meal may have changed. Nothing retries automatically. Retry the identical request or reload to review before making another change.");
    } finally {
      if (alive.current) { action.current = false; setBusy(false); }
    }
  }

  return <div className={styles.rename}>
    {!open ? <Button id={openerId} type="button" variant="ghost" disabled={disabled} onClick={() => { setDraft(name); setMessage(""); setOpen(true); }}>Rename {name}</Button> : <form onSubmit={event => { event.preventDefault(); void save(); }}>
      <label htmlFor={fieldId}>Meal name</label>
      <TextField id={fieldId} value={draft} maxLength={160} autoFocus disabled={disabled || busy || pending !== null} aria-describedby={hintId} onChange={event => setDraft(event.target.value)} />
      <p id={hintId}>Give this familiar combination a name you recognize. Changing it also changes the title on an existing shared link; who can see it stays the same.</p>
      {pending ? <p>Requested name: {pending.name}. Last confirmed name: {name}. The current saved name is not yet confirmed.</p> : null}
      <div className={styles.actions}>
        <Button type="submit" disabled={busy || (disabled && !pending)}>{busy ? "Saving name…" : pending ? "Retry identical name request" : "Save name"}</Button>
        {!pending ? <Button type="button" variant="ghost" disabled={busy} onClick={() => { restoreFocus.current = true; setOpen(false); setDraft(name); setMessage(""); }}>Cancel</Button> : <Button type="button" variant="ghost" disabled={busy} onClick={() => {
          if (action.current || !window.confirm("Reload saved meals and discard only this local retry? The earlier rename is not cancelled and may still finish. Recheck the name before changing it again.")) return;
          onReview();
        }}>Reload to review name</Button>}
      </div>
    </form>}
    {message ? <p className={styles.message} role="status">{message}</p> : null}
  </div>;
}
