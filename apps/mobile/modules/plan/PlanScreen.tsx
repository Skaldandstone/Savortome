import { useCallback, useEffect, useState } from "react";
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
  weekStart,
  type LibraryRecipe,
  type MealSlot,
  type PlannedMeal,
} from "@seconds/core/format";
import { api } from "@/lib/client";
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

/**
 * A week of meals, a day at a time.
 *
 * The web grid puts seven days side by side; a phone can't, so the week
 * becomes a scroll. Every day and slot is still shown, empty ones included —
 * an empty Thursday is what a plan is for.
 */
export function PlanScreen() {
  const [week, setWeek] = useState(() => weekStart(todayISO()));
  const [meals, setMeals] = useState<PlannedMeal[]>([]);
  const [library, setLibrary] = useState<LibraryRecipe[]>([]);
  const [adding, setAdding] = useState<{ date: string; slot: MealSlot } | null>(null);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentToList, setSentToList] = useState<number | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [recentlyRemoved, setRecentlyRemoved] = useState<PlannedMeal | null>(null);
  const [planStatus, setPlanStatus] = useState("");
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const c = usePalette();

  const today = todayISO();

  const load = useCallback(async (forWeek: string) => {
    setError(null);
    try {
      setMeals((await api.plan(forWeek)).meals);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your plan.");
    }
  }, []);

  // Planning happens here, but recipes arrive from other screens.
  useFocusEffect(
    useCallback(() => {
      void load(week);
      void api
        .library()
        .then((data) => setLibrary(data.recipes))
        .catch(() => undefined);
    }, [load, week]),
  );

  const run = async (work: () => Promise<{ meals: PlannedMeal[]; addedToList?: number }>) => {
    setBusy(true);
    setError(null);
    try {
      const data = await work();
      setMeals(data.meals);
      if (data.addedToList) setSentToList(data.addedToList);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const chooseWeek = (next: string) => {
    setConfirmingClear(false);
    setRecentlyRemoved(null);
    setPlanStatus("");
    setWeek(next);
  };

  const removeMeal = async (meal: PlannedMeal) => {
    setPlanStatus("");
    if (await run(() => api.planRemove(meal.recipeId, meal.date, meal.slot, week))) {
      setRecentlyRemoved(meal);
    }
  };

  const undoRemoval = async () => {
    const meal = recentlyRemoved;
    if (!meal) return;
    if (await run(() => api.planAdd(meal.recipeId, meal.date, meal.slot, week))) {
      setRecentlyRemoved(null);
      setPlanStatus(`${meal.title} is back on ${dayLabel(meal.date)}.`);
    }
  };

  const clearWeek = async () => {
    setPlanStatus("");
    if (await run(() => api.planClearWeek(week))) {
      setConfirmingClear(false);
      setRecentlyRemoved(null);
      setPlanStatus("The week is clear.");
    }
  };

  const grid = groupByDay(meals, week);
  const planned = recipeIdsIn(meals).length;
  const shown = filter.trim()
    ? library.filter((r) => r.title.toLowerCase().includes(filter.trim().toLowerCase()))
    : library;

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
          <Button label="←" accessibilityLabel="Previous week" variant="ghost" onPress={() => chooseWeek(shiftWeeks(week, -1))} />
          <Text style={[styles.weekLabel, { color: c.text }]}>{weekLabel(week)}</Text>
          <Button label="→" accessibilityLabel="Next week" variant="ghost" onPress={() => chooseWeek(shiftWeeks(week, 1))} />
        </View>

        <View style={styles.weekActions}>
          <Button
            label="Add week to shopping list"
            disabled={busy || planned === 0}
            onPress={() => void run(() => api.planToShoppingList(week))}
          />
          {planned > 0 ? (
            <Button
              label="Clear week"
              variant="ghost"
              disabled={busy}
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
                disabled={busy}
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
                disabled={busy}
                onPress={() => void undoRemoval()}
              />
            </View>
          </Callout>
        ) : planStatus ? <Callout tone="info">{planStatus}</Callout> : null}
        {error ? <Callout tone="error">{error}</Callout> : null}
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
                    disabled={busy}
                    onPress={() => void removeMeal(meal)}
                  >
                    <Text style={{ color: c.textMuted, fontSize: typeScale.title }}>×</Text>
                  </Pressable>
                </View>
              ))}

              <Button
                label="+ Add"
                variant="ghost"
                disabled={busy}
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
        animationType="slide"
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
          />

          <ScrollView contentContainerStyle={styles.pickList} keyboardShouldPersistTaps="handled">
            {shown.map((recipe) => (
              <Pressable
                key={recipe.id}
                accessibilityRole="button"
                style={[styles.pick, { backgroundColor: c.surface, borderColor: c.border }]}
                onPress={() => {
                  const at = adding;
                  setAdding(null);
                  if (at) void run(() => api.planAdd(recipe.id, at.date, at.slot, week));
                }}
              >
                <Text style={{ color: c.text, fontWeight: "600", fontSize: typeScale.body }}>
                  {recipe.title}
                </Text>
                <Text style={{ color: c.textMuted, fontSize: typeScale.micro }}>
                  {recipe.attribution}
                </Text>
              </Pressable>
            ))}
            {shown.length === 0 ? (
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
