import { Pressable, StyleSheet, Text } from "react-native";
import { radius, type as typeScale } from "./theme";
import { usePalette } from "./ThemeProvider";

export type ButtonVariant = "primary" | "ghost" | "toggle" | "danger";

export function Button({
  label,
  onPress,
  variant = "primary",
  disabled,
  selected,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  selected?: boolean;
  accessibilityLabel?: string;
}) {
  const c = usePalette();

  const background =
    variant === "primary" ? c.accent : selected ? c.accentSoft : "transparent";
  const color =
    variant === "primary"
      ? "#fff"
      : variant === "danger"
        ? c.error
        : selected
          ? c.accent
          : c.textMuted;
  const borderColor =
    variant === "danger"
      ? c.error
      : variant === "ghost" || (variant === "toggle" && selected)
        ? c.border
        : "transparent";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled, selected }}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" ? styles.primary : styles.compact,
        { backgroundColor: background, borderColor, opacity: disabled ? 0.55 : pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={[styles.label, { color }, variant !== "primary" && styles.compactLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.sm, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  primary: { paddingVertical: 12, paddingHorizontal: 20 },
  compact: { paddingVertical: 6, paddingHorizontal: 12 },
  label: { fontWeight: "600", fontSize: typeScale.body },
  compactLabel: { fontSize: typeScale.small, fontWeight: "500" },
});
