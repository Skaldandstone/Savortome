import { StyleSheet, Text, View } from "react-native";
import { IMPORT_STAGES } from "@nomnom/core/format";
import { radius, space, usePalette } from "@/ui";

export function ImportProgress({ stage }: { stage: number }) {
  const c = usePalette();

  return (
    <View
      style={[styles.progress, { backgroundColor: c.surfaceSunken }]}
      accessibilityLiveRegion="polite"
    >
      {IMPORT_STAGES.map((label, i) => {
        const done = i < stage;
        const active = i === stage;
        return (
          <Text
            key={label}
            style={[
              styles.stage,
              { color: done ? c.good : active ? c.text : c.textMuted },
              active && styles.active,
            ]}
          >
            {done ? "✓" : active ? "…" : "·"} {label}
          </Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  progress: { marginTop: space.lg, padding: space.md + 2, borderRadius: radius.sm, gap: 2 },
  stage: { fontSize: 14 },
  active: { fontWeight: "700" },
});
