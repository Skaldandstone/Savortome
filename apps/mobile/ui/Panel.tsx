import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { radius, space, type as typeScale } from "./theme";
import { usePalette } from "./ThemeProvider";

export function Panel({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const c = usePalette();
  return (
    <View style={[styles.panel, { backgroundColor: c.surface, borderColor: c.border }, style]}>
      {children}
    </View>
  );
}

export function PanelHeader({ title, hint }: { title: string; hint?: string }) {
  const c = usePalette();
  return (
    <View style={styles.header}>
      <Text accessibilityRole="header" style={[styles.title, { color: c.text }]}>{title}</Text>
      {hint ? <Text style={[styles.hint, { color: c.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { borderRadius: radius.md, borderWidth: 1, padding: space.lg + 4 },
  header: { marginBottom: space.lg },
  title: { fontSize: typeScale.title, fontWeight: "700", marginBottom: space.xs },
  hint: { fontSize: typeScale.small, lineHeight: 19 },
});
