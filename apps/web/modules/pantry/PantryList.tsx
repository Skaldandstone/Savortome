"use client";

import { useState } from "react";
import {
  formatAmount,
  pantryAttention,
  type PantryEntry,
  type PantryEntryUpdate,
  type PantryStorageLocation,
} from "@seconds/core/format";
import { Button, FieldRow, TextField } from "@/ui";
import styles from "./pantry.module.css";

/** Everything the cook has said is in the kitchen, as removable chips. */
export function PantryList({
  items,
  onAdd,
  onUpdate,
  onRemove,
  onClear,
}: {
  items: PantryEntry[];
  onAdd: (text: string) => void;
  onUpdate: (update: PantryEntryUpdate) => void;
  onRemove: (canonicalItem: string) => void;
  onClear: () => void;
}) {
  const [text, setText] = useState("");

  return (
    <>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          onAdd(text);
          setText("");
        }}
      >
        <FieldRow>
          <TextField
            aria-label="Ingredients to add to your pantry"
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="2 chicken thighs, rice, a can of chopped tomatoes"
          />
          <Button type="submit">Add</Button>
        </FieldRow>
      </form>

      {items.length === 0 ? (
        <p className={styles.empty}>
          Nothing here yet. Type what&apos;s in your kitchen — amounts are optional. Common
          seasonings and baking staples are already assumed; add anything else you keep in.
        </p>
      ) : (
        <>
          <p className={styles.pantryNote}>
            Dates and freshness prompts are memory aids, not expiry dates. Check the food, its label, and package directions.
          </p>
          <ul className={styles.pantryRows}>
            {items.map((item) => {
              const amount = formatAmount(item);
              const attention = pantryAttention(item);
              return (
                <li key={item.canonicalItem} className={styles.pantryRow} data-attention={attention?.shouldResurface || undefined}>
                  <div className={styles.pantryItemHeading}>
                    <div>
                      <strong>{item.displayName}</strong>
                      {amount ? <span className={styles.chipAmount}>{amount}</span> : null}
                    </div>
                    {attention?.shouldResurface ? <span className={styles.checkBadge}>Check what remains</span> : null}
                  </div>

                  {attention?.shouldResurface ? <p className={styles.attentionCopy}>{attention.message}</p> : null}

                  <div className={styles.pantryControls}>
                    <label>
                      <input
                        type="checkbox"
                        checked={item.isUsual ?? false}
                        onChange={event => onUpdate({ canonicalItem: item.canonicalItem, isUsual: event.target.checked })}
                      />
                      I usually buy this
                    </label>
                    <label>
                      Store in
                      <select
                        value={item.storageLocation ?? "unknown"}
                        onChange={event => onUpdate({
                          canonicalItem: item.canonicalItem,
                          storageLocation: event.target.value as PantryStorageLocation,
                        })}
                      >
                        <option value="unknown">Not set</option>
                        <option value="countertop">Countertop</option>
                        <option value="pantry">Pantry or cupboard</option>
                        <option value="refrigerator">Refrigerator</option>
                        <option value="freezer">Freezer</option>
                      </select>
                    </label>
                    <Button type="button" variant="ghost" onClick={() => onUpdate({ canonicalItem: item.canonicalItem, confirmPresent: true })}>
                      Still have this
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => onRemove(item.canonicalItem)} aria-label={`Remove ${item.displayName} from pantry`}>
                      Remove
                    </Button>
                  </div>

                  {attention ? (
                    <details className={styles.storageGuide}>
                      <summary>Storage guidance for {item.displayName}</summary>
                      <p>{attention.guide.storageAdvice}</p>
                      {attention.guide.separationAdvice ? <p>{attention.guide.separationAdvice}</p> : null}
                      <p className={styles.guidanceBoundary}>Conditions vary. This is general guidance, not a guarantee that food is fresh or safe.</p>
                      <a href={attention.guide.sourceUrl} target="_blank" rel="noreferrer">{attention.guide.sourceLabel} (opens in a new tab)</a>
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <Button variant="ghost" type="button" onClick={onClear}>
            Clear pantry
          </Button>
        </>
      )}
    </>
  );
}
