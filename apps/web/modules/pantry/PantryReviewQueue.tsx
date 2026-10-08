"use client";

import { useRef, useState } from "react";
import { formatAmount, type PantryIntakeView } from "@seconds/core/format";
import { Button } from "@/ui";
import styles from "./pantry.module.css";

const REVIEW_DATE = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

function reviewDate(value: string) {
  return REVIEW_DATE.format(new Date(value));
}

export function PantryReviewQueue({
  intakes,
  onResolve,
}: {
  intakes: PantryIntakeView[];
  onResolve: (intakeId: string, action: "accept" | "dismiss", acceptedItemIds?: string[]) => Promise<boolean>;
}) {
  if (intakes.length === 0) return null;
  return (
    <section className={styles.reviewQueue} aria-labelledby="pantry-review-heading">
      <h3 id="pantry-review-heading">Review recent groceries</h3>
      <p>Nothing from an order or receipt enters your pantry until you confirm it here.</p>
      {intakes.map(intake => <PantryReviewCard key={intake.id} intake={intake} onResolve={onResolve} />)}
    </section>
  );
}

function PantryReviewCard({ intake, onResolve }: {
  intake: PantryIntakeView;
  onResolve: (intakeId: string, action: "accept" | "dismiss", acceptedItemIds?: string[]) => Promise<boolean>;
}) {
  const [selected, setSelected] = useState(() => intake.items.map(item => item.id));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [confirmDismiss, setConfirmDismiss] = useState(false);
  const [completed, setCompleted] = useState(false);
  const actionGroup = useRef<HTMLDivElement>(null);
  const source = intake.sourceLabel || (intake.source === "receipt" ? "Scanned receipt" : "Grocery order");

  async function resolve(action: "accept" | "dismiss") {
    setBusy(true);
    setStatus("");
    setError("");
    try {
      const saved = await onResolve(intake.id, action, selected);
      if (saved) {
        setCompleted(true);
        setConfirmDismiss(false);
        setStatus(action === "accept" ? "Selected groceries added to your pantry." : "Review dismissed. No items were added to your pantry.");
      } else {
        setError("We could not confirm that the review saved. Your selection is still here. Check your pantry before trying again.");
      }
    } catch {
      setError("We could not confirm that the review saved. Your selection is still here. Check your pantry before trying again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={styles.reviewCard}>
      <header><strong>{source}</strong>{intake.acquiredAt ? <span>{reviewDate(intake.acquiredAt)}</span> : null}</header>
      <fieldset disabled={busy || completed}>
        <legend>Choose what actually came home</legend>
        {intake.items.map(item => {
          const amount = formatAmount(item);
          return (
            <label key={item.id}>
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                onChange={event => setSelected(current => event.target.checked
                  ? [...current, item.id]
                  : current.filter(id => id !== item.id))}
              />
              <span>{amount ? `${amount} ` : ""}{item.displayName}</span>
            </label>
          );
        })}
      </fieldset>
      <p className={styles.guidanceBoundary}>If an item is already listed, confirming this review replaces its displayed quantity. You can correct it afterward.</p>
      <div ref={actionGroup} className={styles.actions}>
        <Button type="button" disabled={busy || completed || confirmDismiss || selected.length === 0} onClick={() => void resolve("accept")}>{busy ? "Saving review…" : "Add selected items"}</Button>
        <Button type="button" variant="ghost" disabled={busy || completed} aria-expanded={confirmDismiss} onClick={() => { setConfirmDismiss(true); setError(""); }}>Dismiss</Button>
      </div>
      {confirmDismiss ? (
        <div role="group" aria-label={`Dismiss ${source} review`}>
          <p>Dismiss this review without adding any items? You can keep it here to review later.</p>
          <div className={styles.actions}>
            <Button type="button" disabled={busy} onClick={() => void resolve("dismiss")}>Dismiss this review</Button>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => { setConfirmDismiss(false); setError(""); actionGroup.current?.querySelector<HTMLButtonElement>("button[aria-expanded]")?.focus(); }}>Keep reviewing</Button>
          </div>
        </div>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
      {status ? <p role="status">{status}</p> : null}
    </article>
  );
}
