import { StyleSheet, TextInput, type TextInputProps } from "react-native";
import { radius, space, type as typeScale } from "./theme";
import { usePalette } from "./ThemeProvider";

export function Field({ multiline, style, ...rest }: TextInputProps) {
  const c = usePalette();
  return (
    <TextInput
      placeholderTextColor={c.textMuted}
      multiline={multiline}
      style={[
        styles.field,
        { backgroundColor: c.bg, borderColor: c.border, color: c.text },
        multiline && styles.area,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  field: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: space.md + 1,
    paddingVertical: 11,
    fontSize: typeScale.body,
  },
  area: { minHeight: 140, textAlignVertical: "top" },
});
