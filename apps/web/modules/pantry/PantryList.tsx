"use client";

import { useState } from "react";
import type { PantryEntry } from "@nomnom/core/format";
import { formatAmount } from "@nomnom/core/format";
import { Button, FieldRow, TextField } from "@/ui";
import styles from "./pantry.module.css";

/** Everything the cook has said is in the kitchen, as removable chips. */
export function PantryList({
  items,
  onAdd,
  onRemove,
  onClear,
}: {
  items: PantryEntry[];
  onAdd: (text: string) => void;
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
          <ul className={styles.chips}>
            {items.map((item) => {
              const amount = formatAmount(item);
              return (
                <li key={item.canonicalItem}>
                  <button
                    type="button"
                    className={styles.chip}
                    onClick={() => onRemove(item.canonicalItem)}
                    aria-label={`Remove ${item.displayName}`}
                    title="Remove"
                  >
                    {amount ? <span className={styles.chipAmount}>{amount}</span> : null}
                    {item.displayName}
                    <span aria-hidden="true" className={styles.chipX}>
                      ×
                    </span>
                  </button>
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
