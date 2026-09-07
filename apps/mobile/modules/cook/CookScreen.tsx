import { useEffect, useMemo, useRef, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useKeepAwake } from "expo-keep-awake";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  clampStep,
  cookProgress,
  formatAmount,
  formatDuration,
  ingredientsByStep,
  timestampUrl,
  type Recipe,
} from "@seconds/core/format";
import { IngredientList, ServingScaler, useServings } from "@/modules/recipe";
import { Button, Callout, radius, space, type as typeScale, usePalette } from "@/ui";
import { FinishPanel } from "./FinishPanel";
import { TimerTray } from "./TimerTray";
import { useCookSession } from "./useCookSession";
import { useTimers } from "./useTimers";
import { PaperPanel, woodlandEnabled } from '@/modules/woodland/Artwork';
import { useReducedMotion } from '@/ui/ThemeProvider';

/**
 * The recipe, one step at a time, for someone whose hands are busy.
 *
 * Everything here is sized to be read from a propped-up phone at arm's length.
 * The screen stays awake, timers run above whatever step you're on, and
 * finishing offers to record that you cooked it — which is the signal the rest
 * of the app leans on hardest.
 */
export function CookScreen({ recipe, recipeId }: { recipe: Recipe; recipeId: string }) {
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState<ReadonlySet<number>>(() => new Set());
  const [showIngredients, setShowIngredients] = useState(false);
  const [showResumed, setShowResumed] = useState(false);
  /**
   * Whether the saved session has been dealt with — restored, or found absent.
   * State rather than a ref, so a remount correctly re-reads instead of
   * saving over what it was about to restore.
   */
  const [settled, setSettled] = useState(false);
  const timers = useTimers(recipe.title);
  const servings = useServings(recipe);
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollView>(null);
  const router = useRouter();
  const c = usePalette();
  const reducedMotion = useReducedMotion();

  // A phone propped against the sugar tin locks itself every thirty seconds,
  // and unlocking it with batter on your hands is the moment this stops being
  // worth using.
  useKeepAwake();

  const steps = recipe.steps;
  // Destructured: the hook returns a fresh object every render, and depending
  // on it would fire the save effect on every timer tick.
  const { restored, checked, save, clear } = useCookSession(recipeId, steps.length);
  const step = steps[clampStep(index, steps.length)];
  const progress = cookProgress(done, steps.length);

  // Scaled ingredients, so the amount beside a step matches the one the cook
  // set at the top. Recomputed only when that scaling changes, not per step.
  const stepIngredients = useMemo(
    () => ingredientsByStep(steps, servings.ingredients),
    [steps, servings.ingredients],
  );

  // Apply a saved session once the read has landed, then let saving begin.
  useEffect(() => {
    if (!checked || settled) return;
    if (restored) {
      setIndex(restored.stepIndex);
      setDone(restored.done);
      timers.restore(restored.timers);
      setShowResumed(true);
    }
    setSettled(true);
    // timers is rebuilt every render; depending on it would re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, restored, settled]);

  // Never write before the restore has settled, or this saves the empty state
  // it starts in over the session it is about to read.
  useEffect(() => {
    if (!settled) return;
    if (progress.finished) clear();
    else save(index, done, timers.timers);
  }, [settled, index, done, timers.timers, progress.finished, save, clear]);

  const go = (delta: number) => setIndex((i) => clampStep(i + delta, steps.length));

  /** Throw the restored session away and begin the recipe again. */
  const startOver = () => {
    setShowResumed(false);
    setIndex(0);
    setDone(new Set());
    for (const timer of timers.timers) timers.dismiss(timer.stepN);
    clear();
  };

  const toggleDone = (n: number) =>
    setDone((current) => {
      const next = new Set(current);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  /** Tick the step off and move on — the single gesture the whole screen is for. */
  const completeAndAdvance = () => {
    if (!step) return;
    setDone((current) => new Set(current).add(step.n));
    if (index < steps.length - 1) go(1);
  };

  // A new step starts at the top, however far down the last one was read.
  useEffect(() => {
    scroller.current?.scrollTo({ y: 0, animated: !reducedMotion });
  }, [index, reducedMotion]);

  if (!step) {
    return (
      <View style={[styles.empty, { backgroundColor: c.bg, paddingTop: insets.top + space.xl }]}>
        <Stack.Screen options={{ headerShown: true, title: recipe.title }} />
        <Callout tone="warn" title="Nothing to cook from">
          This recipe has no steps yet. Add some and come back.
        </Callout>
        <Button
          label="Edit recipe"
          onPress={() => router.replace(`/recipe/${recipeId}/edit`)}
        />
      </View>
    );
  }

  const forThisStep = stepIngredients.get(step.n) ?? [];
  const timer = timers.timerFor(step.n);
  const videoLink =
    step.sourceTimestamp !== null ? timestampUrl(recipe.source, step.sourceTimestamp) : null;
  const timerState = timer ? timers.stateOf(timer) : null;

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: recipe.title }} />

      <ScrollView
        ref={scroller}
        style={{ backgroundColor: c.bg }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
      >
        <Pressable
          onPress={() => setShowIngredients((s) => !s)}
          accessibilityRole="button"
          accessibilityState={{ expanded: showIngredients }}
          style={[styles.toggle, { borderColor: c.border, backgroundColor: c.surface }]}
        >
          <Text style={{ color: c.textMuted, fontSize: typeScale.small }}>
            {showIngredients ? "Hide" : "Show"} ingredients
          </Text>
        </Pressable>

        {showIngredients ? (
          <View
            style={[styles.ingredients, { backgroundColor: c.surface, borderColor: c.border }]}
          >
            {servings.canScale && servings.servings !== null ? (
              <ServingScaler
                servings={servings.servings}
                onIncrement={servings.increment}
                onDecrement={servings.decrement}
              />
            ) : null}
            <IngredientList ingredients={servings.ingredients} />
          </View>
        ) : null}

        <TimerTray
          timers={timers.timers}
          remaining={timers.remaining}
          stateOf={timers.stateOf}
          onPause={timers.pause}
          onResume={timers.resume}
          onReset={timers.reset}
          onDismiss={timers.dismiss}
        />

        {showResumed ? (
          <View style={[styles.resumed, { backgroundColor: c.surfaceSunken }]}>
            <Text style={{ color: c.textMuted, fontSize: typeScale.small, flex: 1 }}>
              Picked up where you left off.
            </Text>
            <Button label="Start over" variant="ghost" onPress={startOver} />
          </View>
        ) : null}

        <View
          style={[styles.progress, { backgroundColor: c.surfaceSunken }]}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: progress.total, now: progress.done }}
          accessibilityLabel="Steps done"
        >
          <View
            style={[
              styles.progressFill,
              { backgroundColor: c.accent, width: `${progress.fraction * 100}%` },
            ]}
          />
        </View>

        <PaperPanel style={woodlandEnabled ? undefined : [styles.stage,{backgroundColor:c.surface,borderColor:c.border}]}>
        {(c) => <>
          <Text style={[styles.counter, { color: c.textMuted }]}>
            STEP {step.n} OF {steps.length}
          </Text>
          <Text style={[styles.text, { color: done.has(step.n) ? c.textMuted : c.text }]}>
            {step.text}
          </Text>

          {forThisStep.length > 0 ? (
            <View style={styles.amounts} accessibilityLabel="Amounts for this step">
              {forThisStep.map((ingredient) => (
                <View
                  key={ingredient.raw + ingredient.canonicalItem}
                  style={[styles.amount, { backgroundColor: c.surfaceSunken }]}
                >
                  <Text style={[styles.amountText, { color: c.textMuted }]}>
                    <Text style={[styles.amountQuantity, { color: c.text }]}>
                      {formatAmount(ingredient)}
                    </Text>{" "}
                    {ingredient.item || ingredient.canonicalItem}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.extras}>
            {step.timerSeconds ? (
              timer ? (
                // The tray above is doing the shouting; this just says which
                // state the timer for *this* step is in.
                <Text
                  style={{
                    color: timerState === "ringing" ? c.warn : c.textMuted,
                    fontSize: typeScale.small,
                    fontWeight: timerState === "ringing" ? "600" : "400",
                  }}
                >
                  {timerState === "ringing"
                    ? "Timer finished"
                    : timerState === "paused"
                      ? `Timer paused — ${formatDuration(timers.remaining(timer))}`
                      : `Timer running — ${formatDuration(Math.max(timers.remaining(timer), 0))}`}
                </Text>
              ) : (
                <Button
                  label={`⏱ Start ${formatDuration(step.timerSeconds)}`}
                  variant="ghost"
                  onPress={() => timers.start(step)}
                />
              )
            ) : null}

            {videoLink ? (
              <Button
                label="▶ Watch this bit"
                variant="ghost"
                onPress={() => void Linking.openURL(videoLink)}
              />
            ) : null}
          </View>
        </>}
        </PaperPanel>

        <View style={styles.controls}>
          <Button label="← Back" variant="ghost" disabled={index === 0} onPress={() => go(-1)} />
          <View style={styles.primary}>
            <Button
              label={index === steps.length - 1 ? "Finish" : "Done, next →"}
              onPress={completeAndAdvance}
            />
          </View>
        </View>

        {done.has(step.n) ? (
          <Button
            label="Untick this step"
            variant="ghost"
            onPress={() => toggleDone(step.n)}
          />
        ) : index < steps.length - 1 ? (
          // Skipping moves on without ticking, so the recipe never claims you
          // did something you didn't.
          <Button label="Skip" variant="ghost" onPress={() => go(1)} />
        ) : null}

        {progress.finished ? <FinishPanel recipeId={recipeId} /> : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  // The one thing a step never says. Set beside the instruction rather than
  // inside it, so the sentence still reads as a sentence.
  amounts: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.lg },
  amount: { paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: radius.sm },
  amountText: { fontSize: typeScale.body },
  amountQuantity: { fontWeight: "700" },
  content: { padding: space.lg, gap: space.md },
  empty: { flex: 1, padding: space.lg, gap: space.lg },
  toggle: {
    alignSelf: "flex-end",
    minHeight: 44,
    justifyContent: "center",
    paddingVertical: 7,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  ingredients: {
    padding: space.md + 2,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  resumed: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
  },
  progress: { height: 4, borderRadius: radius.pill, overflow: "hidden" },
  progressFill: { height: "100%" },
  stage: { padding: space.lg + 4, borderWidth: 1, borderRadius: radius.md, gap: space.md },
  counter: { fontSize: typeScale.micro, fontWeight: "700", letterSpacing: 1.4 },
  // Sized to be read from arm's length, across a worktop.
  text: { fontSize: 22, lineHeight: 32 },
  extras: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.md },
  controls: { flexDirection: "row", alignItems: "center", gap: space.md },
  primary: { flex: 1, alignItems: "stretch" },
});
