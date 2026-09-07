"use client";

import { useState } from "react";
import type { ShelfSummary } from "@seconds/core/format";
import { Button, TextField } from "@/ui";
import styles from "./shelves.module.css";

/**
 * Custom shelves, where a recipe can sit on as many as you like. Kept separate
 * from the status control because the two behave differently on purpose.
 */
export function ShelfChecklist({
  shelves,
  shelfIds,
  disabled,
  onToggle,
  onCreate,
}: {
  shelves: ShelfSummary[];
  shelfIds: string[];
  disabled?: boolean;
  onToggle: (shelfId: string, member: boolean) => void;
  onCreate: (name: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const custom = shelves.filter((s) => s.type === "custom");

  return (
    <div className={styles.checklist}>
      {custom.map((shelf) => {
        const member = shelfIds.includes(shelf.id);
        return (
          <label key={shelf.id} className={styles.checkItem}>
            <input
              type="checkbox"
              checked={member}
              disabled={disabled}
              onChange={(e) => onToggle(shelf.id, e.target.checked)}
            />
            {shelf.name}
          </label>
        );
      })}

      {adding ? (
        <form
          className={styles.newShelf}
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            onCreate(name);
            setName("");
            setAdding(false);
          }}
        >
          <TextField
            type="text"
            aria-label="New shelf name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Shelf name"
            autoFocus
            maxLength={60}
          />
          <Button variant="ghost" type="submit">
            Add
          </Button>
        </form>
      ) : (
        <Button variant="ghost" type="button" onClick={() => setAdding(true)}>
          + New shelf
        </Button>
      )}
    </div>
  );
}
