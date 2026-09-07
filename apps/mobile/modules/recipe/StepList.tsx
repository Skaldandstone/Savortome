import { Linking, StyleSheet, Text, View } from "react-native";
import { timestampUrl, type Recipe, type Step } from "@seconds/core/format";
import { radius, space, type as typeScale, usePalette } from "@/ui";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const formatTimer = (seconds: number) =>
  seconds < 90 ? `${seconds}s` : `${Math.round(seconds / 60)} min`;

function StepMeta({ step, source }: { step: Step; source: Recipe["source"] }) {
  const c = usePalette();
  const link = step.sourceTimestamp !== null ? timestampUrl(source, step.sourceTimestamp) : null;
  if (!link && !step.timerSeconds) return null;

  return (
    <View style={styles.meta}>
      {link ? (
        <Text
          accessibilityRole="link"
          accessibilityLabel={`Open source at ${mmss(step.sourceTimestamp as number)}`}
          style={[styles.jump, { backgroundColor: c.accentSoft, color: c.accent }]}
          onPress={() => Linking.openURL(link)}
        >
          ▶ {mmss(step.sourceTimestamp as number)}
        </Text>
      ) : null}
      {step.timerSeconds ? (
        <Text style={[styles.timer, { color: c.textMuted }]}>⏱ {formatTimer(step.timerSeconds)}</Text>
      ) : null}
    </View>
  );
}

export function StepList({ steps, source }: { steps: Step[]; source: Recipe["source"] }) {
  const c = usePalette();
  return (
    <View>
      {steps.map((step) => (
        <View key={step.n} style={styles.step}>
          <Text style={[styles.number, { color: c.accent }]}>{step.n}</Text>
          <View style={styles.stepBody}>
            <Text style={[styles.text, { color: c.text }]}>{step.text}</Text>
            <StepMeta step={step} source={source} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: "row", gap: space.md, paddingVertical: space.sm },
  number: { fontWeight: "700", fontSize: typeScale.body, minWidth: 22 },
  stepBody: { flex: 1, minWidth:100 },
  text: { fontSize: typeScale.body, lineHeight: 22 },
  meta: { flexDirection: "row", gap: space.sm + 2, marginTop: 6, alignItems: "center" },
  jump: { fontSize: typeScale.micro, minHeight: 44, paddingHorizontal: 8, paddingVertical: 12, borderRadius: radius.pill, overflow: "hidden" },
  timer: { fontSize: typeScale.micro },
});
