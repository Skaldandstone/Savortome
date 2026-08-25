"use client";

import { SHELF_LABEL } from "@nomnom/core/format";
import { Callout } from "@/ui";
import { ShelfChecklist } from "./ShelfChecklist";
import { StarRating } from "./StarRating";
import { StatusPicker } from "./StatusPicker";
import { useShelfState } from "./useShelfState";
import styles from "./shelves.module.css";

/**
 * The shelving strip that sits under a saved recipe: where it is in your
 * cooking lifecycle, what you thought of it, and which of your own shelves it
 * belongs on.
 *
 * Renders nothing for an unsaved recipe — there is nothing to shelve until the
 * card has an id in the database.
 */
export function ShelfControls({ recipeId }: { recipeId: string | null }) {
  const { shelves, state, saving, error, setStatus, toggleShelf, createShelf, rate } =
    useShelfState(recipeId);

  if (!recipeId) return null;

  const cooked = state?.rating?.timesCooked ?? 0;

  return (
    <section className={styles.controls} aria-label="Shelves and rating">
      <div className={styles.row}>
        <h3 className={styles.label}>Shelf</h3>
        <StatusPicker status={state?.status ?? null} disabled={!state} onChange={setStatus} />
      </div>

      {state?.status === "cooked" || cooked > 0 ? (
        <div className={styles.row}>
          <h3 className={styles.label}>Your rating</h3>
          <StarRating
            stars={state?.rating?.stars ?? 0}
            disabled={!state || saving}
            onRate={(stars) => void rate(stars)}
          />
          {cooked > 0 ? (
            <span className={styles.cookCount}>
              cooked {cooked} {cooked === 1 ? "time" : "times"}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className={styles.row}>
        <h3 className={styles.label}>Your shelves</h3>
        <ShelfChecklist
          shelves={shelves}
          shelfIds={state?.shelfIds ?? []}
          disabled={!state || saving}
          onToggle={(shelfId, member) => void toggleShelf(shelfId, member)}
          onCreate={(name) => void createShelf(name)}
        />
      </div>

      {error ? (
        <Callout tone="error" role="alert">
          {error}
        </Callout>
      ) : null}
    </section>
  );
}

/** Small badge naming the status shelf a recipe sits on, for list rows. */
export function ShelfBadge({ status }: { status: keyof typeof SHELF_LABEL | null }) {
  if (!status) return null;
  return (
    <span className={styles.badge} data-status={status}>
      {SHELF_LABEL[status]}
    </span>
  );
}
