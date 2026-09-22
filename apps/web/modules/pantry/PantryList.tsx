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
  onAdd: (text: string) => Promise<boolean>;
  onUpdate: (update: PantryEntryUpdate) => Promise<boolean>;
  onRemove: (canonicalItem: string) => Promise<boolean>;
  onClear: () => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  const [editingAmount, setEditingAmount] = useState<string | null>(null);
  const [remainingAmount, setRemainingAmount] = useState("");
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [adding, setAdding] = useState(false);
  const [savingAmount, setSavingAmount] = useState(false);
  const [clearing, setClearing] = useState(false);

  const startAmountEdit = (item: PantryEntry) => {
    setEditingAmount(item.canonicalItem);
    setRemainingAmount(item.quantity === null ? "" : String(item.quantity));
  };

  const saveAmount = async (item: PantryEntry) => {
    const quantity = Number(remainingAmount);
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    setSavingAmount(true);
    const saved = await onUpdate({ canonicalItem: item.canonicalItem, quantity, unit: item.unit, confirmPresent: true });
    setSavingAmount(false);
    if (saved) {
      setEditingAmount(null);
      setRemainingAmount("");
    }
  };

  return (
    <>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const pending = text.trim();
          if (!pending || adding) return;
          setAdding(true);
          const saved = await onAdd(pending);
          setAdding(false);
          if (saved) setText("");
        }}
      >
        <FieldRow>
          <TextField
            aria-label="Ingredients to add to your pantry"
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="2 chicken thighs, rice, a can of chopped tomatoes"
            disabled={adding}
          />
          <Button type="submit" disabled={adding || !text.trim()}>{adding ? "Adding…" : "Add"}</Button>
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

                  {attention?.shouldResurface ? (
                    <div className={styles.promptActions} aria-label={`Freshness prompt actions for ${item.displayName}`}>
                      <Button type="button" variant="ghost" onClick={() => onUpdate({ canonicalItem: item.canonicalItem, confirmPresent: true })}>Yes, still here</Button>
                      <Button type="button" variant="ghost" onClick={() => startAmountEdit(item)}>Used some</Button>
                      <Button type="button" variant="ghost" onClick={() => onRemove(item.canonicalItem)}>All gone</Button>
                      <Button type="button" variant="ghost" onClick={() => onUpdate({ canonicalItem: item.canonicalItem, snoozeDays: 3 })}>Remind me in 3 days</Button>
                      <Button type="button" variant="ghost" onClick={() => onUpdate({ canonicalItem: item.canonicalItem, resurfaceHidden: true })}>Hide this suggestion</Button>
                    </div>
                  ) : null}

                  {editingAmount === item.canonicalItem ? (
                    <form className={styles.amountEditor} onSubmit={async event => { event.preventDefault(); await saveAmount(item); }}>
                      <label htmlFor={`remaining-${item.canonicalItem}`}>How many {item.unit ? `${item.unit} ` : ""}remain?</label>
                      <TextField
                        id={`remaining-${item.canonicalItem}`}
                        type="number"
                        min="0.01"
                        step="any"
                        inputMode="decimal"
                        value={remainingAmount}
                        onChange={event => setRemainingAmount(event.target.value)}
                        disabled={savingAmount}
                        required
                      />
                      <Button type="submit" disabled={savingAmount || !Number.isFinite(Number(remainingAmount)) || Number(remainingAmount) <= 0}>{savingAmount ? "Saving…" : "Save amount"}</Button>
                      <Button type="button" variant="ghost" disabled={savingAmount} onClick={() => setEditingAmount(null)}>Cancel</Button>
                    </form>
                  ) : null}

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
                      <input
                        type="checkbox"
                        checked={!(item.resurfaceHidden ?? false)}
                        onChange={event => onUpdate({ canonicalItem: item.canonicalItem, resurfaceHidden: !event.target.checked })}
                      />
                      Show freshness prompts
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
                    {!attention?.shouldResurface ? (
                      <Button type="button" variant="ghost" onClick={() => onUpdate({ canonicalItem: item.canonicalItem, confirmPresent: true })}>
                        Still have this
                      </Button>
                    ) : null}
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
          <Button variant="ghost" type="button" aria-expanded={confirmingClear} onClick={() => setConfirmingClear(true)}>
            Clear pantry
          </Button>
          {confirmingClear ? (
            <div className={styles.clearConfirm} role="group" aria-label="Confirm clearing pantry">
              <span>This removes every pantry item and its freshness history.</span>
              <Button type="button" variant="danger" disabled={clearing} onClick={async () => {
                setClearing(true);
                const saved = await onClear();
                setClearing(false);
                if (saved) setConfirmingClear(false);
              }}>{clearing ? "Clearing…" : "Clear every item"}</Button>
              <Button type="button" variant="ghost" disabled={clearing} onClick={() => setConfirmingClear(false)}>Keep my pantry</Button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
