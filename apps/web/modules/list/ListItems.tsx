"use client";

import { formatAmount, groupByAisle, type ShoppingLine } from "@seconds/core/format";
import styles from "./list.module.css";

type Item = ShoppingLine & { id: string };

/** The list itself. Unchecked first, so what's left to find stays at the top. */
export function ListItems({
  items,
  disabled,
  onToggle,
  onRemove,
}: {
  items: Item[];
  disabled?: boolean;
  onToggle: (itemId: string, checked: boolean) => void;
  onRemove: (itemId: string) => void;
}) {
  if (items.length === 0) {
    return (
      <p className={styles.empty}>
        Nothing on the list. Add a recipe from your library, or the missing ingredients from a
        pantry search.
      </p>
    );
  }

  const outstanding = items.filter((i) => !i.checked);
  const done = items.filter((i) => i.checked);

  // Only what's left to find is grouped. Once something is in the basket the
  // aisle stops being information, so the done pile stays one flat list.
  const sections = groupByAisle(outstanding);

  return (
    <>
      {sections.map((section) => (
        <section key={section.aisle} className={styles.aisle}>
          {/* A single section means a single heading saying nothing useful. */}
          {sections.length > 1 ? <h3 className={styles.aisleLabel}>{section.label}</h3> : null}
          <ul className={styles.items}>
            {section.items.map((item) => (
              <Row
                key={item.id}
                item={item}
                disabled={disabled}
                onToggle={onToggle}
                onRemove={onRemove}
              />
            ))}
          </ul>
        </section>
      ))}

      {done.length > 0 ? (
        <details className={styles.done}>
          <summary>{done.length} in the basket</summary>
          <ul className={styles.items}>
            {done.map((item) => (
              <Row key={item.id} item={item} disabled={disabled} onToggle={onToggle} onRemove={onRemove} />
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}

function Row({
  item,
  disabled,
  onToggle,
  onRemove,
}: {
  item: Item;
  disabled?: boolean;
  onToggle: (itemId: string, checked: boolean) => void;
  onRemove: (itemId: string) => void;
}) {
  const amount = formatAmount(item);

  return (
    <li className={styles.item} data-checked={item.checked}>
      <label className={styles.itemLabel}>
        <input
          type="checkbox"
          checked={item.checked}
          disabled={disabled}
          onChange={(e) => onToggle(item.id, e.target.checked)}
        />
        <span className={styles.amount}>{amount}</span>
        <span className={styles.name}>
          {item.displayName}
          {item.mayAlreadyHave ? (
            <span className={styles.note}> · you may already have some</span>
          ) : null}
          {item.recipeIds.length > 1 ? (
            <span className={styles.note}> · {item.recipeIds.length} recipes</span>
          ) : null}
        </span>
      </label>
      <button
        type="button"
        className={styles.remove}
        onClick={() => onRemove(item.id)}
        disabled={disabled}
        aria-label={`Remove ${item.displayName}`}
      >
        ×
      </button>
    </li>
  );
}
