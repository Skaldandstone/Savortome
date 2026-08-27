"use client";

import { useEffect, useRef, useState } from "react";
import {
  formatAmount,
  ingredientFromLine,
  isGroupHeading,
  type Ingredient,
} from "@seconds/core/format";
import { RowActions } from "./RowActions";
import styles from "./editor.module.css";

/**
 * One line per ingredient, typed the way a recipe writes it.
 *
 * People think "2 tbsp olive oil", not amount / unit / item in three boxes, so
 * that's what they type and the same parser the importer uses splits it. The
 * name it lands on is shown back underneath, because that's what pantry search
 * and the shopping list join on — if we read the line wrong, this is the only
 * place it's visible before the recipe quietly stops matching.
 */
export function IngredientRows({
  ingredients,
  onReplace,
  onAdd,
  onAddHeading,
  onRemove,
  onMove,
}: {
  ingredients: Ingredient[];
  onReplace: (index: number, ingredient: Ingredient) => void;
  onAdd: () => void;
  onAddHeading: () => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
}) {
  return (
    <div className={styles.rows}>
      {ingredients.map((ingredient, index) => (
        <IngredientRow
          // Index as key: rows have no stable identity, and reordering rewrites
          // the whole array anyway.
          key={index}
          ingredient={ingredient}
          index={index}
          count={ingredients.length}
          onReplace={onReplace}
          onRemove={onRemove}
          onMove={onMove}
        />
      ))}

      <div className={styles.addRows}>
        <button type="button" className={styles.addRow} onClick={onAdd}>
          + Add ingredient
        </button>
        <button type="button" className={styles.addRow} onClick={onAddHeading}>
          + Add section
        </button>
      </div>
    </div>
  );
}

function IngredientRow({
  ingredient,
  index,
  count,
  onReplace,
  onRemove,
  onMove,
}: {
  ingredient: Ingredient;
  index: number;
  count: number;
  onReplace: (index: number, ingredient: Ingredient) => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
}) {
  const line = ingredient.raw || [formatAmount(ingredient), ingredient.item].filter(Boolean).join(" ");
  const [text, setText] = useState(line);
  const [editing, setEditing] = useState(false);
  const typed = useRef(line);

  // Reordering and removal change which ingredient a row is showing, and the
  // box has to follow. The guard is what keeps it from also snapping back onto
  // the parsed line mid-word, which would eat every space as you typed it.
  useEffect(() => {
    if (line.trim() !== typed.current.trim()) {
      typed.current = line;
      setText(line);
    }
  }, [line]);

  /**
   * Parse on every keystroke, not on blur.
   *
   * Blur is nearly right and fails in the one place it matters: type the last
   * ingredient, click Save, and the click can be handled before the blur's
   * state update has landed — so the recipe saves without the line you just
   * typed, or refuses to save at all for having no ingredients.
   *
   * A line nobody touches never fires this, which is the other half of what's
   * wanted: an imported ingredient keeps the structure the extractor gave it
   * rather than being quietly re-read by a simpler parser.
   */
  const parse = (next: string) => {
    typed.current = next;
    setText(next);
    onReplace(index, {
      ...ingredientFromLine(next, ingredient.group),
      optional: ingredient.optional,
    });
  };

  // What pantry search will actually join on. Held back until the field is left
  // alone — live, it just narrates half-typed words back at you.
  const canonical = ingredient.canonicalItem.trim();
  const showCanonical = !editing && canonical && canonical !== text.trim().toLowerCase();

  // A heading names the section everything under it belongs to. It buys
  // nothing, so it has no pantry name and can't be optional.
  const heading = isGroupHeading(ingredient);

  return (
    <div className={styles.row} data-heading={heading}>
      <div className={styles.rowMain}>
        <input
          className={heading ? styles.headingInput : styles.lineInput}
          value={text}
          placeholder={heading ? "For the sauce:" : "2 tbsp olive oil"}
          aria-label={heading ? `Section ${index + 1}` : `Ingredient ${index + 1}`}
          onChange={(e) => parse(e.target.value)}
          onFocus={() => setEditing(true)}
          onBlur={() => setEditing(false)}
        />
        {!heading && showCanonical ? (
          <p className={styles.understood}>
            Matches <strong>{canonical}</strong> in your pantry
          </p>
        ) : null}
      </div>

      {heading ? null : (
        <label className={styles.optional}>
          <input
            type="checkbox"
            checked={ingredient.optional}
            onChange={(e) => onReplace(index, { ...ingredient, optional: e.target.checked })}
          />
          Optional
        </label>
      )}

      <RowActions
        index={index}
        count={count}
        label={heading ? "section" : "ingredient"}
        onMove={onMove}
        onRemove={onRemove}
      />
    </div>
  );
}
