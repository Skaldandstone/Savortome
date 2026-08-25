"use client";

import styles from "./editor.module.css";

/**
 * Reorder and remove, for a row in a list. Real buttons rather than a drag
 * handle: dragging is unusable with a keyboard and fiddly on a phone, and the
 * lists here are short enough that two taps is fine.
 */
export function RowActions({
  index,
  count,
  label,
  onMove,
  onRemove,
}: {
  index: number;
  count: number;
  /** What one row is, for the screen-reader labels: "ingredient", "step". */
  label: string;
  onMove: (from: number, to: number) => void;
  onRemove: (index: number) => void;
}) {
  const position = `${label} ${index + 1}`;

  return (
    <div className={styles.rowActions}>
      <button
        type="button"
        className={styles.rowAction}
        aria-label={`Move ${position} up`}
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
      >
        ↑
      </button>
      <button
        type="button"
        className={styles.rowAction}
        aria-label={`Move ${position} down`}
        disabled={index === count - 1}
        onClick={() => onMove(index, index + 1)}
      >
        ↓
      </button>
      <button
        type="button"
        className={styles.rowAction}
        aria-label={`Remove ${position}`}
        onClick={() => onRemove(index)}
      >
        ×
      </button>
    </div>
  );
}
