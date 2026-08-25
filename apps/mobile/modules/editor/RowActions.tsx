import { Pressable, StyleSheet, Text, View } from "react-native";
import { radius, space, type as typeScale, usePalette } from "@/ui";

/**
 * Reorder and remove, for a row in a list. Buttons rather than a drag handle:
 * dragging inside a scrolling form is a fight on a phone, and the lists here
 * are short enough that two taps is fine.
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
    <View style={styles.actions}>
      <Action
        glyph="↑"
        label={`Move ${position} up`}
        disabled={index === 0}
        onPress={() => onMove(index, index - 1)}
      />
      <Action
        glyph="↓"
        label={`Move ${position} down`}
        disabled={index === count - 1}
        onPress={() => onMove(index, index + 1)}
      />
      <Action glyph="×" label={`Remove ${position}`} onPress={() => onRemove(index)} />
    </View>
  );
}

function Action({
  glyph,
  label,
  disabled,
  onPress,
}: {
  glyph: string;
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const c = usePalette();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: c.surfaceSunken,
          borderColor: c.border,
          opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Text style={{ color: c.textMuted, fontSize: typeScale.body }}>{glyph}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: space.xs },
  action: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: radius.sm,
  },
});
