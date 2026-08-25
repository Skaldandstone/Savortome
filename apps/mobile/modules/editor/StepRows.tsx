import { StyleSheet, Text, View } from "react-native";
import type { Step } from "@nomnom/core/format";
import { Field, space, type as typeScale, usePalette } from "@/ui";
import { AddRow } from "./IngredientRows";
import { RowActions } from "./RowActions";

/** The method, one box per step. Numbering is positional and never typed. */
export function StepRows({
  steps,
  onReplace,
  onAdd,
  onRemove,
  onMove,
}: {
  steps: Step[];
  onReplace: (index: number, step: Step) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
}) {
  const c = usePalette();

  return (
    <View style={styles.rows}>
      {steps.map((step, index) => (
        <View style={styles.row} key={index}>
          <View style={styles.rowTop}>
            <Text style={[styles.number, { color: c.textMuted }]}>{index + 1}</Text>
            <Field
              value={step.text}
              multiline
              placeholder="Heat the oil over medium heat until it shimmers."
              accessibilityLabel={`Step ${index + 1}`}
              style={styles.stepInput}
              onChangeText={(text) => onReplace(index, { ...step, text })}
            />
          </View>
          <View style={styles.rowActions}>
            <RowActions
              index={index}
              count={steps.length}
              label="step"
              onMove={onMove}
              onRemove={onRemove}
            />
          </View>
        </View>
      ))}

      <AddRow label="+ Add step" onPress={onAdd} />
    </View>
  );
}

const styles = StyleSheet.create({
  rows: { gap: space.md },
  row: { gap: space.xs },
  rowTop: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  number: { width: 16, paddingTop: 12, fontSize: typeScale.small, textAlign: "right" },
  // Steps are a sentence or two, not the wall of text the shared field assumes.
  stepInput: { flex: 1, minHeight: 76 },
  rowActions: { alignSelf: "flex-end" },
});
