import { StyleSheet, Text, View } from "react-native";
import { Button, radius, space, type as typeScale, usePalette } from "@/ui";

/** "You copied a link — want to import it?" shown when the app comes forward. */
export function ClipboardSuggestion({
  url,
  onUse,
  onDismiss,
}: {
  url: string;
  onUse: () => void;
  onDismiss: () => void;
}) {
  const c = usePalette();

  return (
    <View style={[styles.box, { backgroundColor: c.accentSoft, borderColor: c.border }]}>
      <Text style={[styles.label, { color: c.textMuted }]}>Link on your clipboard</Text>
      <Text numberOfLines={1} style={[styles.url, { color: c.text }]}>
        {url}
      </Text>
      <View style={styles.actions}>
        <Button label="Use it" variant="ghost" onPress={onUse} />
        <Button label="Dismiss" variant="ghost" onPress={onDismiss} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: space.md, borderRadius: radius.sm, borderWidth: 1, marginBottom: space.md },
  label: { fontSize: typeScale.micro, marginBottom: 2 },
  url: { fontSize: typeScale.small, marginBottom: space.sm },
  actions: { flexDirection: "row", gap: space.sm },
});
