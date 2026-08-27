import { StyleSheet, View } from "react-native";
import type { ImportMode } from "@seconds/core/format";
import { Button, space } from "@/ui";

const MODES: { value: ImportMode; label: string }[] = [
  { value: "url", label: "From a link" },
  { value: "text", label: "Paste text" },
];

export function ModeSwitch({
  mode,
  onChange,
}: {
  mode: ImportMode;
  onChange: (mode: ImportMode) => void;
}) {
  return (
    <View style={styles.row}>
      {MODES.map(({ value, label }) => (
        <Button
          key={value}
          variant="toggle"
          label={label}
          selected={mode === value}
          onPress={() => onChange(value)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: space.xs, marginBottom: space.md + 2 },
});
