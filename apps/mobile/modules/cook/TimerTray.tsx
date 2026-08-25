import { StyleSheet, Text, View } from "react-native";
import { formatDuration, type CookTimer, type TimerState } from "@nomnom/core/format";
import { Button, radius, space, type as typeScale, usePalette } from "@/ui";

/**
 * Every running timer, pinned above the step you're reading.
 *
 * Timers belong to the session, not to the step that started them: the reason
 * you set one is so you can move on, and a timer you have to navigate back to
 * is a timer you'll forget.
 */
export function TimerTray({
  timers,
  remaining,
  stateOf,
  onPause,
  onResume,
  onReset,
  onDismiss,
}: {
  timers: CookTimer[];
  remaining: (timer: CookTimer) => number;
  stateOf: (timer: CookTimer) => TimerState;
  onPause: (stepN: number) => void;
  onResume: (stepN: number) => void;
  onReset: (stepN: number) => void;
  onDismiss: (stepN: number) => void;
}) {
  const c = usePalette();
  if (timers.length === 0) return null;

  return (
    <View style={styles.tray}>
      {timers.map((timer) => {
        const state = stateOf(timer);
        const left = remaining(timer);
        const ringing = state === "ringing";

        return (
          <View
            key={timer.stepN}
            style={[
              styles.timer,
              {
                backgroundColor: ringing ? c.warnSoft : c.surface,
                borderColor: ringing ? c.warn : c.border,
                opacity: state === "paused" ? 0.7 : 1,
              },
            ]}
          >
            <View style={styles.head}>
              <View style={styles.headText}>
                <Text style={[styles.step, { color: c.textMuted }]}>STEP {timer.stepN}</Text>
                <Text numberOfLines={1} style={[styles.label, { color: c.text }]}>
                  {timer.label}
                </Text>
              </View>
              <Text
                style={[styles.clock, { color: ringing ? c.warn : c.text }]}
                // Announced only when it rings; a per-second live region would
                // read the whole countdown aloud.
                accessibilityLiveRegion={ringing ? "assertive" : "none"}
              >
                {formatDuration(ringing ? left : Math.max(left, 0))}
              </Text>
            </View>

            {ringing ? (
              <Text style={[styles.done, { color: c.warn }]}>Time&apos;s up</Text>
            ) : null}

            <View style={styles.actions}>
              {state === "running" ? (
                <Button label="Pause" variant="ghost" onPress={() => onPause(timer.stepN)} />
              ) : state === "paused" ? (
                <Button label="Resume" variant="ghost" onPress={() => onResume(timer.stepN)} />
              ) : null}
              <Button label="Reset" variant="ghost" onPress={() => onReset(timer.stepN)} />
              <Button label="Clear" variant="ghost" onPress={() => onDismiss(timer.stepN)} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tray: { gap: space.sm },
  timer: { gap: space.sm, padding: space.md + 2, borderWidth: 1, borderRadius: radius.md },
  head: { flexDirection: "row", alignItems: "center", gap: space.md },
  headText: { flex: 1, minWidth: 0 },
  step: { fontSize: typeScale.micro, fontWeight: "700", letterSpacing: 1 },
  label: { fontSize: typeScale.small },
  clock: { fontSize: 30, fontWeight: "600", fontVariant: ["tabular-nums"] },
  done: { fontSize: typeScale.small, fontWeight: "600" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.xs },
});
