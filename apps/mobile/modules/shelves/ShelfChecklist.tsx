import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ShelfSummary } from "@seconds/core/format";
import { Button, Field, radius, space, type as typeScale, usePalette } from "@/ui";

/** Custom shelves, where a recipe can sit on as many as you like. */
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
  const c = usePalette();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const custom = shelves.filter((s) => s.type === "custom");

  const submit = () => {
    if (!name.trim()) return;
    onCreate(name);
    setName("");
    setAdding(false);
  };

  return (
    <View style={styles.wrap}>
      {custom.map((shelf) => {
        const member = shelfIds.includes(shelf.id);
        return (
          <Pressable
            key={shelf.id}
            disabled={disabled}
            onPress={() => onToggle(shelf.id, !member)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: member }}
            style={[
              styles.chip,
              {
                backgroundColor: member ? c.accentSoft : "transparent",
                borderColor: member ? c.accent : c.border,
              },
            ]}
          >
            <Text style={{ color: member ? c.accent : c.textMuted, fontSize: typeScale.small }}>
              {member ? "✓ " : ""}
              {shelf.name}
            </Text>
          </Pressable>
        );
      })}

      {adding ? (
        <View style={styles.newShelf}>
          <Field
            value={name}
            onChangeText={setName}
            placeholder="Shelf name"
            autoFocus
            maxLength={60}
            onSubmitEditing={submit}
            style={styles.newShelfInput}
          />
          <Button label="Add" variant="ghost" onPress={submit} />
        </View>
      ) : (
        <Button label="+ New shelf" variant="ghost" disabled={disabled} onPress={() => setAdding(true)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.sm },
  chip: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  newShelf: { flexDirection: "row", alignItems: "center", gap: space.xs },
  newShelfInput: { minWidth: 150, paddingVertical: 6 },
});
