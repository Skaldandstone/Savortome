import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dayLabel,
  groupByDay,
  isISODate,
  isMealSlot,
  mealSlotOr,
  recipeIdsIn,
  shiftWeeks,
  todayISO,
  weekDays,
  weekEnd,
  weekLabel,
  weekStart,
  type PlannedMeal,
} from "../src/plan.js";

const meal = (recipeId: string, date: string, slot: PlannedMeal["slot"]): PlannedMeal => ({
  recipeId, date, slot, title: recipeId, imageUrl: null, totalMinutes: null,
});

describe("week arithmetic", () => {
  it("finds the Monday of any day in the week", () => {
    // 2026-09-02 is a Wednesday.
    assert.equal(weekStart("2026-09-02"), "2026-08-31");
    assert.equal(weekStart("2026-08-31"), "2026-08-31", "a Monday is its own week start");
    // Sunday belongs to the week that started six days earlier, not the next one.
    assert.equal(weekStart("2026-09-06"), "2026-08-31");
  });

  it("runs Monday to Sunday", () => {
    const days = weekDays("2026-08-31");
    assert.equal(days.length, 7);
    assert.equal(days[0], "2026-08-31");
    assert.equal(days[6], "2026-09-06");
    assert.equal(weekEnd("2026-08-31"), "2026-09-06");
  });

  it("crosses a month boundary without losing a day", () => {
    assert.deepEqual(weekDays("2026-08-31").slice(0, 3), ["2026-08-31", "2026-09-01", "2026-09-02"]);
  });

  it("crosses a year boundary", () => {
    assert.equal(shiftWeeks("2026-12-28", 1), "2027-01-04");
    assert.equal(weekStart("2027-01-01"), "2026-12-28");
  });

  it("survives a daylight-saving Sunday", () => {
    // The clocks go back in the UK on 2026-10-25. Arithmetic done in local time
    // gives that week a 25-hour day and can repeat or skip a date; UTC doesn't.
    const days = weekDays(weekStart("2026-10-25"));
    assert.equal(new Set(days).size, 7, "seven distinct dates");
    assert.deepEqual(days, [
      "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22",
      "2026-10-23", "2026-10-24", "2026-10-25",
    ]);
  });

  it("steps whole weeks in both directions", () => {
    assert.equal(shiftWeeks("2026-08-31", 1), "2026-09-07");
    assert.equal(shiftWeeks("2026-08-31", -1), "2026-08-24");
    assert.equal(shiftWeeks("2026-08-31", 0), "2026-08-31");
  });
});

describe("labels", () => {
  it("names a day short enough for a column heading", () => {
    assert.equal(dayLabel("2026-09-01"), "Tue 1 Sep");
    assert.equal(dayLabel("2026-08-31"), "Mon 31 Aug");
  });

  it("names a week, and only repeats the month when it has to", () => {
    assert.equal(weekLabel("2026-09-07"), "7–13 Sep");
    assert.equal(weekLabel("2026-08-31"), "31 Aug–6 Sep");
  });
});

describe("dates and slots", () => {
  it("recognises a real ISO date and rejects the rest", () => {
    assert.equal(isISODate("2026-09-01"), true);
    assert.equal(isISODate("2026-9-1"), false);
    assert.equal(isISODate("not a date"), false);
    assert.equal(isISODate("2026-13-01"), false);
  });

  it("gives today as a plain local date", () => {
    // Built from local parts, so someone at 23:30 gets today rather than
    // tomorrow's UTC date.
    assert.equal(todayISO(new Date(2026, 8, 1, 23, 30)), "2026-09-01");
    assert.equal(todayISO(new Date(2026, 0, 5, 0, 15)), "2026-01-05");
  });

  it("falls back to dinner for anything unrecognised", () => {
    assert.equal(isMealSlot("lunch"), true);
    assert.equal(isMealSlot("brunch"), false);
    assert.equal(mealSlotOr("brunch"), "dinner");
    assert.equal(mealSlotOr("breakfast"), "breakfast");
  });
});

describe("grouping for the grid", () => {
  const meals = [
    meal("a", "2026-08-31", "dinner"),
    meal("b", "2026-08-31", "dinner"),
    meal("c", "2026-09-02", "lunch"),
  ];

  it("returns every day and slot, including the empty ones", () => {
    // The gaps are the point: an empty Thursday is what a plan makes visible.
    const grid = groupByDay(meals, "2026-08-31");
    assert.equal(grid.length, 7);
    assert.equal(grid[0]!.slots.length, 3);
    assert.deepEqual(grid[3]!.slots.map((s) => s.meals.length), [0, 0, 0]);
  });

  it("puts several recipes in one slot, which is how a main and a side works", () => {
    const grid = groupByDay(meals, "2026-08-31");
    const monDinner = grid[0]!.slots.find((s) => s.slot === "dinner")!;
    assert.deepEqual(monDinner.meals.map((m) => m.recipeId), ["a", "b"]);
  });

  it("ignores anything outside the week it was asked about", () => {
    const grid = groupByDay([meal("x", "2026-10-01", "dinner")], "2026-08-31");
    assert.equal(grid.every((d) => d.slots.every((s) => s.meals.length === 0)), true);
  });
});

describe("recipeIdsIn", () => {
  it("collapses a recipe planned twice into one shopping trip", () => {
    assert.deepEqual(
      recipeIdsIn([
        meal("a", "2026-08-31", "dinner"),
        meal("a", "2026-09-02", "lunch"),
        meal("b", "2026-09-03", "dinner"),
      ]),
      ["a", "b"],
    );
  });
});
