"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  MEAL_SLOT_LABEL,
  dayLabel,
  type LibraryRecipe,
  type MealSlot,
} from "@seconds/core/format";
import { TextField } from "@/ui";
import styles from "./plan.module.css";

/**
 * Picking a recipe for a slot.
 *
 * A native `<dialog>`, so Escape, the backdrop, and focus trapping are the
 * browser's job rather than three bugs of mine. Filtering is client-side
 * against the library already loaded — the list is small, and a round trip per
 * keystroke to answer "which of my own recipes" would be slower than the
 * typing.
 */
export function AddMealDialog({
  date,
  slot,
  recipes,
  loaded,
  loading,
  loadError,
  onRetry,
  onPick,
  onClose,
}: {
  date: string;
  slot: MealSlot;
  recipes: LibraryRecipe[];
  loaded: boolean;
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
  onPick: (recipeId: string) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const shown = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return recipes;
    return recipes.filter((r) => r.title.toLowerCase().includes(needle));
  }, [filter, recipes]);

  return (
    <dialog ref={dialog} className={styles.dialog} onClose={onClose} aria-labelledby={titleId}>
      <form method="dialog" className={styles.dialogHead}>
        <div>
          <h2 className={styles.dialogTitle} id={titleId}>
            {MEAL_SLOT_LABEL[slot]}, {dayLabel(date)}
          </h2>
          <p className={styles.dialogHint}>Pick something from your recipes.</p>
        </div>
        <button className={styles.dialogClose} aria-label="Close">
          ×
        </button>
      </form>

      <TextField
        value={filter}
        placeholder="Filter your recipes"
        aria-label="Filter your recipes"
        autoFocus
        disabled={!loaded}
        onChange={(e) => setFilter(e.target.value)}
      />

      {loading && !loaded ? (
        <p className={styles.pickerStatus} role="status">Loading your recipes…</p>
      ) : null}

      {loadError ? (
        <div className={styles.pickerError} role="alert">
          <p>
            {loaded
              ? "Your recipes could not refresh. The last list we loaded is still available."
              : "Your recipes could not load. Nothing has been added to this meal yet."}
          </p>
          <button type="button" className={styles.pickerRetry} disabled={loading} onClick={onRetry}>
            {loading ? "Trying again…" : "Try recipes again"}
          </button>
        </div>
      ) : null}

      <ul className={styles.pickList}>
        {loaded ? shown.map((recipe) => (
          <li key={recipe.id}>
            <button type="button" className={styles.pick} onClick={() => onPick(recipe.id)}>
              <strong>{recipe.title}</strong>
              <span>{recipe.attribution}</span>
            </button>
          </li>
        )) : null}
        {loaded && !loadError && shown.length === 0 ? (
          <li className={styles.pickEmpty}>
            {recipes.length === 0
              ? "Nothing in your recipes yet — import or write one first."
              : `Nothing matches “${filter}”.`}
          </li>
        ) : null}
      </ul>
    </dialog>
  );
}
