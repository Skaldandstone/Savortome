"use client";

import { SHELF_ACTION, STATUS_SHELVES, type StatusShelf } from "@nomnom/core/format";
import { Button } from "@/ui";
import styles from "./shelves.module.css";

/**
 * The three built-in shelves as one exclusive control. Pressing the shelf a
 * recipe is already on takes it off — the same gesture in reverse.
 */
export function StatusPicker({
  status,
  disabled,
  onChange,
}: {
  status: StatusShelf | null;
  disabled?: boolean;
  onChange: (status: StatusShelf) => void;
}) {
  return (
    <div className={styles.statusPicker} role="group" aria-label="Shelf">
      {STATUS_SHELVES.map((shelf) => (
        <Button
          key={shelf}
          variant="toggle"
          type="button"
          aria-pressed={status === shelf}
          disabled={disabled}
          onClick={() => onChange(shelf)}
        >
          {SHELF_ACTION[shelf]}
        </Button>
      ))}
    </div>
  );
}
