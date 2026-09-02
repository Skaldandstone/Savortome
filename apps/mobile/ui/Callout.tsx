import { StyleSheet, Text, View } from "react-native";
import { radius, space, type as typeScale } from "./theme";
import { usePalette } from "./ThemeProvider";

export type CalloutTone = "info" | "warn" | "error";

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: CalloutTone;
  title?: string;
  children?: React.ReactNode;
}) {
  const c = usePalette();
  const background =
    tone === "warn" ? c.warnSoft : tone === "error" ? c.errorSoft : c.surfaceSunken;
  const color = tone === "warn" ? c.warn : tone === "error" ? c.error : c.textMuted;

  return (
    <View style={[styles.callout, { backgroundColor: background }]}>
      {title ? <Text style={[styles.title, { color }]}>{title}</Text> : null}
      {typeof children === "string" ? (
        <Text style={[styles.body, { color }]}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  callout: { marginTop: space.lg, padding: space.md + 2, borderRadius: radius.sm },
  title: { fontWeight: "700", marginBottom: space.xs, fontSize: typeScale.small },
  body: { fontSize: typeScale.small, lineHeight: 19 },
});
