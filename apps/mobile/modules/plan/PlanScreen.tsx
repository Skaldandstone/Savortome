import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  MEAL_SLOTS,
  MEAL_SLOT_LABEL,
  dayLabel,
  groupByDay,
  recipeIdsIn,
  shiftWeeks,
  todayISO,
  weekLabel,
  type LibraryRecipe,
  type MealSlot,
  type PlannedMeal,
  type SecondsClient,
} from "@seconds/core/format";
import {
  Button,
  Callout,
  Field,
  Panel,
  PanelHeader,
  radius,
  space,
  type as typeScale,
  usePalette,
} from "@/ui";
import { useReducedMotion } from "@/ui/ThemeProvider";

/**
 * A week of meals, a day at a time.
 *
 * The web grid puts seven days side by side; a phone can't, so the week
 * becomes a scroll. Every day and slot is still shown, empty ones included —
 * an empty Thursday is what a plan is for.
 */
export function PlanScreen({ initialWeek, client }: { initialWeek: string; client: SecondsClient }) {
  const [week, setWeek] = useState(initialWeek);
  const alive = useRef(true); const visit = useRef(0); const currentWeek = useRef(week); currentWeek.current = week;
  const mutation = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; ++visit.current; }; }, []);
  const [meals, setMeals] = useState<PlannedMeal[]>([]);
  const [loadedWeek, setLoadedWeek] = useState<string | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const planRequest = useRef(0);
  const [library, setLibrary] = useState<LibraryRecipe[]>([]);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const libraryRequest = useRef(0);
  const [adding, setAdding] = useState<{ date: string; slot: MealSlot } | null>(null);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const uncertain = useRef(false);
  const [reviewReloaded, setReviewReloaded] = useState(false);
  const [sentToList, setSentToList] = useState<number | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [recentlyRemoved, setRecentlyRemoved] = useState<PlannedMeal | null>(null);
  const [planStatus, setPlanStatus] = useState("");
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const c = usePalette();
  const reducedMotion = useReducedMotion();

  const today = todayISO();

  const load = useCallback(async (forWeek: string) => {
    const version = visit.current;
    const request = ++planRequest.current;
    setPlanLoading(true); setPlanError(null);
    try {
      const result = await client.plan(forWeek);
      if (alive.current && visit.current === version && currentWeek.current === forWeek && planRequest.current === request) { setMeals(result.meals); setLoadedWeek(forWeek); if (uncertain.current) setReviewReloaded(true); }
    } catch (err) {
      if (alive.current && visit.current === version && currentWeek.current === forWeek && planRequest.current === request) setPlanError("Your plan could not load. Nothing has been deleted. Load it again before changing meals.");
    } finally {
      if (alive.current && visit.current === version && planRequest.current === request) setPlanLoading(false);
    }
  }, [client]);
  const loadLibrary = useCallback(async () => {
    const version = visit.current; const request = ++libraryRequest.current;
    setLibraryLoading(true); setLibraryError(null);
    try {
      const result = await client.library();
      if (alive.current && visit.current === version && libraryRequest.current === request) { setLibrary(result.recipes); setLibraryLoaded(true); }
    } catch {
      if (alive.current && visit.current === version && libraryRequest.current === request) setLibraryError("Your recipes could not load. Your collection was not deleted. Try loading it again.");
    } finally { if (alive.current && visit.current === version && libraryRequest.current === request) setLibraryLoading(false); }
  }, [client]);

  // Planning happens here, but recipes arrive from other screens.
  useFocusEffect(
    useCallback(() => {
      ++visit.current;
      mutation.current = false; setBusy(false);
      void load(week);
      void loadLibrary();
      return () => { ++visit.current; };
    }, [load, loadLibrary, week]),
  );

  const run = async (work: () => Promise<{ meals: PlannedMeal[]; addedToList?: number }>) => {
    if (mutation.current || uncertain.current || planLoading || loadedWeek !== week || planError) return false;
    mutation.current = true;
    // Freeze other writes immediately, including if focus changes before this
    // request settles. Suppressing late feedback must not imply no write ran.
    uncertain.current = true; setUnconfirmed(true); setReviewReloaded(false);
    const version = visit.current; const selectedWeek = week;
    ++planRequest.current;
    setBusy(true);
    setError(null);
    try {
      const data = await work();
      if (!alive.current || visit.current !== version || currentWeek.current !== selectedWeek) return false;
      setMeals(data.meals);
      setLoadedWeek(selectedWeek);
      uncertain.current = false; setUnconfirmed(false); setReviewReloaded(false);
      if (data.addedToList) setSentToList(data.addedToList);
      return true;
    } catch (err) {
      if (alive.current && visit.current === version) { uncertain.current = true; setUnconfirmed(true); setReviewReloaded(false); setError("We could not confirm that change. It may already have saved. Reload the plan and check your shopping list if you sent meals there. Do not repeat an uncertain shopping-list write automatically."); }
      return false;
    } finally {
      if (alive.current && visit.current === version) { mutation.current = false; setBusy(false); }
    }
  };

  const chooseWeek = (next: string) => {
    if (mutation.current || uncertain.current) return;
    setConfirmingClear(false);
    setRecentlyRemoved(null);
    setPlanStatus("");
    setSentToList(null); setAdding(null); setPlanError(null); setLoadedWeek(null);
    setWeek(next);
  };

  const removeMeal = async (meal: PlannedMeal) => {
    setPlanStatus("");
    if (await run(() => client.planRemove(meal.recipeId, meal.date, meal.slot, week))) {
      setRecentlyRemoved(meal);
    }
  };

  const undoRemoval = async () => {
    const meal = recentlyRemoved;
    if (!meal) return;
    if (await run(() => client.reviewedPlanAdd({ recipeId: meal.recipeId, date: meal.date, slot: meal.slot }))) {
      setRecentlyRemoved(null);
      setPlanStatus(`${meal.title} is back on ${dayLabel(meal.date)}.`);
    }
  };

  const clearWeek = async () => {
    setPlanStatus("");
    if (await run(() => client.planClearWeek(week))) {
      setConfirmingClear(false);
      setRecentlyRemoved(null);
      setPlanStatus("The week is clear.");
    }
  };

  const grid = loadedWeek === week ? groupByDay(meals, week) : [];
  const planned = loadedWeek === week ? recipeIdsIn(meals).length : 0;
  const shown = filter.trim()
    ? library.filter((r) => r.title.toLowerCase().includes(filter.trim().toLowerCase()))
    : library;
  const blocked = busy || unconfirmed || planLoading || loadedWeek !== week || planError !== null;

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]}
    >
      <Panel>
        <PanelHeader
          title="The week"
          hint="What you're cooking, and when. The whole week can become one shopping list."
        />

        <View style={styles.weekBar}>
          <Button label="←" accessibilityLabel="Previous week" variant="ghost" disabled={busy || unconfirmed} onPress={() => chooseWeek(shiftWeeks(week, -1))} />
          <Text style={[styles.weekLabel, { color: c.text }]}>{weekLabel(week)}</Text>
          <Button label="→" accessibilityLabel="Next week" variant="ghost" disabled={busy || unconfirmed} onPress={() => chooseWeek(shiftWeeks(week, 1))} />
        </View>
        {planLoading ? <Text accessibilityLiveRegion="polite" style={[styles.calloutText, { color: c.textMuted }]}>Loading this week… Editing is paused.</Text> : null}
        {planError ? <Callout tone="error"><Text style={[styles.calloutText, { color: c.textMuted }]}>{planError}</Text><Button label="Load this week again" disabled={planLoading || busy} onPress={() => void load(week)} /></Callout> : null}
        {loadedWeek === week && (planLoading || planError) ? <Text style={[styles.calloutText, { color: c.textMuted }]}>Showing the last loaded meals for this week. They may have changed.</Text> : null}

        <View style={styles.weekActions}>
          <Button
            label="Add week to shopping list"
            disabled={blocked || planned === 0}
            onPress={() => void run(() => client.planToShoppingList(week))}
          />
          {planned > 0 ? (
            <Button
              label="Clear week"
              variant="ghost"
              disabled={blocked}
              selected={confirmingClear}
              onPress={() => {
                setPlanStatus("");
                setConfirmingClear(true);
              }}
            />
          ) : null}
        </View>

        {confirmingClear ? (
          <Callout tone="warn" title="Clear this week?">
            <Text style={[styles.calloutText, { color: c.textMuted }]}>Remove every planned meal from {weekLabel(week)}?</Text>
            <View style={styles.recoveryActions}>
              <Button
                label={busy ? "Clearing…" : "Clear every meal"}
                variant="danger"
                disabled={blocked}
                onPress={() => void clearWeek()}
              />
              <Button label="Keep this week" variant="ghost" disabled={busy} onPress={() => setConfirmingClear(false)} />
            </View>
          </Callout>
        ) : null}

        {sentToList ? (
          <Callout tone="info">
            {sentToList} {sentToList === 1 ? "recipe" : "recipes"} added — duplicates merged and
            anything already in your pantry left off.
          </Callout>
        ) : null}
        {recentlyRemoved ? (
          <Callout tone="info" title={`${recentlyRemoved.title} removed`}>
            <Text style={[styles.calloutText, { color: c.textMuted }]}>From {MEAL_SLOT_LABEL[recentlyRemoved.slot].toLowerCase()} on {dayLabel(recentlyRemoved.date)}.</Text>
            <View style={styles.recoveryActions}>
              <Button
                label={busy ? "Restoring…" : "Undo"}
                disabled={blocked}
                onPress={() => void undoRemoval()}
              />
            </View>
          </Callout>
        ) : planStatus ? <Callout tone="info">{planStatus}</Callout> : null}
        {error ? <Callout tone="error">{error}</Callout> : null}
        {unconfirmed ? <Callout tone="warn" title="Check the result before another change">
          <Text style={[styles.calloutText, { color: c.textMuted }]}>Your request may still finish later. Reloading is a current view, not proof that a timed-out write never saved. Leaving this screen may lose this local warning.</Text>
          <Button label="Reload this week to review" disabled={planLoading || busy} onPress={() => void load(week)} />
          <Button label="Check shopping list" variant="ghost" onPress={() => router.push("/(protected)/(tabs)/list")} />
          <Button label="I reviewed the result; allow further changes" variant="ghost" disabled={!reviewReloaded || planLoading || planError !== null} onPress={() => { uncertain.current = false; setUnconfirmed(false); setError(null); setConfirmingClear(false); setRecentlyRemoved(null); setSentToList(null); setPlanStatus("Review acknowledged. No request was repeated and nothing was undone."); }} />
        </Callout> : null}
      </Panel>

      {grid.map((day) => (
        <View
          key={day.date}
          style={[
            styles.day,
            { backgroundColor: c.surface, borderColor: day.date === today ? c.accent : c.border },
          ]}
        >
          <View style={styles.dayHead}>
            <Text style={{ color: c.text, fontWeight: "700", fontSize: typeScale.body }}>
              {dayLabel(day.date)}
            </Text>
            {day.date === today ? (
              <Text style={{ color: c.accent, fontSize: typeScale.micro, fontWeight: "600" }}>
                TODAY
              </Text>
            ) : null}
          </View>

          {day.slots.map(({ slot, meals: inSlot }) => (
            <View key={slot} style={styles.slot}>
              <Text accessibilityRole="header" style={[styles.slotLabel, { color: c.textMuted }]}>
                {MEAL_SLOT_LABEL[slot].toUpperCase()}
              </Text>

              {inSlot.map((meal) => (
                <View
                  key={meal.recipeId}
                  style={[styles.meal, { backgroundColor: c.surfaceSunken }]}
                >
                  <Pressable
                    style={styles.mealTitle}
                    accessibilityRole="button"
                    onPress={() => router.push(`/recipe/${meal.recipeId}`)}
                  >
                    <Text style={{ color: c.text, fontSize: typeScale.small }}>{meal.title}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${meal.title} from ${dayLabel(day.date)}`}
                    style={styles.remove}
                    disabled={blocked}
                    onPress={() => void removeMeal(meal)}
                  >
                    <Text style={{ color: c.textMuted, fontSize: typeScale.title }}>×</Text>
                  </Pressable>
                </View>
              ))}

              <Button
                label="+ Add"
                variant="ghost"
                disabled={blocked}
                onPress={() => {
                  setFilter("");
                  setAdding({ date: day.date, slot });
                }}
              />
            </View>
          ))}
        </View>
      ))}

      <Modal
        visible={adding !== null}
        animationType={reducedMotion ? "none" : "slide"}
        presentationStyle="pageSheet"
        onRequestClose={() => setAdding(null)}
      >
        <View accessibilityViewIsModal style={[styles.sheet, { backgroundColor: c.bg, paddingTop: insets.top + space.lg }]}>
          <View style={styles.sheetHead}>
            <Text style={{ color: c.text, fontWeight: "700", fontSize: typeScale.title }}>
              {adding ? `${MEAL_SLOT_LABEL[adding.slot]}, ${dayLabel(adding.date)}` : ""}
            </Text>
            <Button label="Close" variant="ghost" onPress={() => setAdding(null)} />
          </View>

          <Field
            value={filter}
            placeholder="Filter your recipes"
            autoCapitalize="none"
            accessibilityLabel="Filter your recipes"
            onChangeText={setFilter}
            editable={libraryLoaded && !busy}
          />
          {libraryLoading ? <Text accessibilityLiveRegion="polite" style={[styles.calloutText, { color: c.textMuted }]}>Loading your recipes…</Text> : null}
          {libraryError ? <Callout tone="error"><Text style={[styles.calloutText, { color: c.textMuted }]}>{libraryError}</Text><Button label="Load recipes again" disabled={libraryLoading} onPress={() => void loadLibrary()} /></Callout> : null}

          <ScrollView contentContainerStyle={styles.pickList} keyboardShouldPersistTaps="handled">
            {libraryLoaded ? shown.map((recipe) => (
              <Pressable
                key={recipe.id}
                accessibilityRole="button"
                style={[styles.pick, { backgroundColor: c.surface, borderColor: c.border }]}
                disabled={blocked || libraryLoading || libraryError !== null}
                onPress={() => {
                  const at = adding;
                  setAdding(null);
                  if (at) void run(() => client.reviewedPlanAdd({ recipeId: recipe.id, date: at.date, slot: at.slot }));
                }}
              >
                <Text style={{ color: c.text, fontWeight: "600", fontSize: typeScale.body }}>
                  {recipe.title}
                </Text>
                <Text style={{ color: c.textMuted, fontSize: typeScale.micro }}>
                  {recipe.attribution}
                </Text>
              </Pressable>
            )) : null}
            {libraryLoaded && !libraryLoading && !libraryError && shown.length === 0 ? (
              <Text style={{ color: c.textMuted, fontSize: typeScale.small }}>
                {library.length === 0
                  ? "Nothing in your recipes yet — import or write one first."
                  : `Nothing matches “${filter}”.`}
              </Text>
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg + 4, paddingBottom: space.xxl * 3, gap: space.md },
  weekBar: { flexDirection: "row", alignItems: "center", gap: space.sm, marginTop: space.xs },
  weekLabel: { flex: 1, textAlign: "center", fontWeight: "700", fontSize: typeScale.title },
  weekActions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.md },
  calloutText: { fontSize: typeScale.small, lineHeight: 20 },
  recoveryActions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.sm },
  day: { padding: space.md + 2, borderWidth: 1, borderRadius: radius.md, gap: space.sm },
  dayHead: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  slot: { gap: 4 },
  slotLabel: { fontSize: typeScale.micro, fontWeight: "600", letterSpacing: 1 },
  meal: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingVertical: 7,
    paddingHorizontal: space.sm + 2,
    borderRadius: radius.sm,
  },
  mealTitle: { flex: 1, minHeight: 44, justifyContent: "center" },
  remove: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  sheet: { flex: 1, padding: space.lg, gap: space.md },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.sm },
  pickList: { gap: space.sm, paddingBottom: space.xxl },
  pick: { minHeight: 44, padding: space.md, borderWidth: 1, borderRadius: radius.sm, gap: 2 },
});
