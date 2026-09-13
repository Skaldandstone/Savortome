"use client";

import { useState } from "react";
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
  const source = intake.sourceLabel || (intake.source === "receipt" ? "Scanned receipt" : "Grocery order");

  async function resolve(action: "accept" | "dismiss") {
    setBusy(true);
    setStatus("");
    const saved = await onResolve(intake.id, action, selected);
    if (saved) setStatus(action === "accept" ? "Selected groceries added to your pantry." : "Review dismissed.");
    setBusy(false);
  }

  return (
    <article className={styles.reviewCard}>
      <header><strong>{source}</strong>{intake.acquiredAt ? <span>{reviewDate(intake.acquiredAt)}</span> : null}</header>
      <fieldset disabled={busy}>
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
      <div className={styles.actions}>
        <Button type="button" disabled={busy || selected.length === 0} onClick={() => void resolve("accept")}>{busy ? "Saving…" : "Add selected items"}</Button>
        <Button type="button" variant="ghost" disabled={busy} onClick={() => void resolve("dismiss")}>Dismiss</Button>
      </div>
      {status ? <p role="status">{status}</p> : null}
    </article>
  );
}
