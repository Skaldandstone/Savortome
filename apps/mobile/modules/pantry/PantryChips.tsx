import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatAmount, type PantryEntry } from "@seconds/core/format";
import { Button, Field, radius, space, type as typeScale, usePalette } from "@/ui";

/** Everything the cook has said is in the kitchen, as tap-to-remove chips. */
export function PantryChips({
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
  const c = usePalette();
  const [text, setText] = useState("");

  const submit = () => {
    if (!text.trim()) return;
    onAdd(text);
    setText("");
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.addRow}>
        <Field
          value={text}
          onChangeText={setText}
          placeholder="2 chicken thighs, rice, tomatoes"
          accessibilityLabel="Add pantry ingredients"
          autoCapitalize="none"
          onSubmitEditing={submit}
          style={styles.input}
        />
        <Button label="Add" variant="ghost" onPress={submit} />
      </View>

      {items.length === 0 ? (
        <Text style={[styles.empty, { color: c.textMuted }]}>
          Nothing here yet. Common seasonings and baking staples are already assumed; add
          anything else you keep in.
        </Text>
      ) : (
        <>
          <View style={styles.chips}>
            {items.map((item) => {
              const amount = formatAmount(item);
              return (
                <Pressable
                  key={item.canonicalItem}
                  onPress={() => onRemove(item.canonicalItem)}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.displayName}`}
                  style={[styles.chip, { backgroundColor: c.surface, borderColor: c.border }]}
                >
                  {amount ? (
                    <Text style={[styles.chipAmount, { color: c.textMuted }]}>{amount} </Text>
                  ) : null}
                  <Text style={{ color: c.text, fontSize: typeScale.small }}>
                    {item.displayName}
                  </Text>
                  <Text style={[styles.chipX, { color: c.textMuted }]}> ×</Text>
                </Pressable>
              );
            })}
          </View>
          <Button label="Clear pantry" variant="ghost" onPress={onClear} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  addRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  input: { flex: 1 },
  empty: { fontSize: typeScale.small, lineHeight: 19 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "baseline",
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipAmount: { fontWeight: "600", fontSize: typeScale.small },
  chipX: { fontSize: typeScale.small },
});
