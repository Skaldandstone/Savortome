import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import {
  formatAmount,
  ingredientFromLine,
  isGroupHeading,
  type Ingredient,
} from "@seconds/core/format";
import { Field, radius, space, type as typeScale, usePalette } from "@/ui";
import { RowActions } from "./RowActions";

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
    <View style={styles.rows}>
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

      <View style={styles.addRows}>
        <AddRow label="+ Add ingredient" onPress={onAdd} />
        <AddRow label="+ Add section" onPress={onAddHeading} />
      </View>
    </View>
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
  const line =
    ingredient.raw || [formatAmount(ingredient), ingredient.item].filter(Boolean).join(" ");
  const [text, setText] = useState(line);
  const [editing, setEditing] = useState(false);
  const typed = useRef(line);
  const c = usePalette();

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
   * ingredient, tap Save, and the tap can be handled before the blur's state
   * update has landed — so the recipe saves without the line just typed, or
   * refuses to save at all for having no ingredients.
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
    <View style={[styles.row, heading && styles.headingRow]}>
      <View style={styles.rowTop}>
        <Field
          value={text}
          placeholder={heading ? "For the sauce:" : "2 tbsp olive oil"}
          accessibilityLabel={heading ? `Section ${index + 1}` : `Ingredient ${index + 1}`}
          style={[
            styles.lineInput,
            heading && { backgroundColor: c.surfaceSunken, color: c.textMuted, fontWeight: "700" },
          ]}
          onChangeText={parse}
          onFocus={() => setEditing(true)}
          onBlur={() => setEditing(false)}
        />
        <RowActions
          index={index}
          count={count}
          label={heading ? "section" : "ingredient"}
          onMove={onMove}
          onRemove={onRemove}
        />
      </View>

      {heading ? null : (
        <View style={styles.rowMeta}>
          {showCanonical ? (
            <Text style={[styles.canonical, { color: c.textMuted }]}>
              Ingredient name for pantry matching:{" "}
              <Text style={styles.canonicalName}>{canonical}</Text>
            </Text>
          ) : (
            <View style={styles.canonicalSpacer} />
          )}

          <View style={styles.optional}>
            <Text style={{ color: c.textMuted, fontSize: typeScale.micro }}>Optional</Text>
            <Switch
              value={ingredient.optional}
              accessibilityLabel={`Ingredient ${index + 1} is optional`}
              onValueChange={(optional) => onReplace(index, { ...ingredient, optional })}
            />
          </View>
        </View>
      )}
    </View>
  );
}

/** The dashed "one more" button both lists end with. */
export function AddRow({ label, onPress }: { label: string; onPress: () => void }) {
  const c = usePalette();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.addRow,
        { borderColor: c.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Text style={{ color: c.accent, fontSize: typeScale.small }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rows: { gap: space.sm },
  row: { gap: space.xs },
  headingRow: { marginTop: space.sm },
  addRows: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  rowTop: { flexDirection: "row", alignItems: "center", gap: space.sm },
  lineInput: { flex: 1 },
  rowMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  canonical: { flex: 1, fontSize: typeScale.micro, paddingRight: space.sm },
  canonicalName: { fontWeight: "700" },
  canonicalSpacer: { flex: 1 },
  optional: { flexDirection: "row", alignItems: "center", gap: space.xs },
  addRow: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: 7,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: radius.sm,
  },
});
