import assert from "node:assert/strict";
import test from "node:test";
import { parsePlanTogetherInput, parsePlanTogetherOptions, suggestPlanTogether, type PlanTogetherCandidate } from "../src/plan-together.js";
import type { PantryEntry } from "../src/pantry.js";

function candidate(overrides: Partial<PlanTogetherCandidate> & Pick<PlanTogetherCandidate, "recipeId" | "title">): PlanTogetherCandidate {
  return {
    imageUrl: null, totalMinutes: 20, tags: [], ingredients: [], have: [], missing: [],
    missingOptional: [], missingStaples: [], coverage: 1, canMakeNow: true, ...overrides,
  };
}

function pantry(canonicalItem: string, daysAgo: number): PantryEntry {
  return {
    canonicalItem, displayName: canonicalItem, quantity: 6, unit: null, isStaple: false,
    acquiredAt: new Date(Date.UTC(2026, 8, 13 - daysAgo)).toISOString(),
    lastConfirmedAt: null, updatedAt: null,
  };
}

test("removes detected allergen conflicts before ranking", () => {
  const ideas = suggestPlanTogether([
    candidate({ recipeId: "a", title: "Peanut noodles", ingredients: ["peanut", "noodle"] }),
    candidate({ recipeId: "b", title: "Tomato rice", ingredients: ["tomato", "rice"] }),
  ], [], { dietaryTags: [], allergens: ["peanuts"] });
  assert.deepEqual(ideas.map(idea => idea.recipeId), ["b"]);
});

test("resurfaces forgotten produce before equally complete pantry matches", () => {
  const now = new Date("2026-09-13T12:00:00.000Z");
  const ideas = suggestPlanTogether([
    candidate({ recipeId: "toast", title: "Toast", have: ["bread"] }),
    candidate({ recipeId: "muffin", title: "Banana muffins", have: ["banana"], ingredients: ["banana", "flour"] }),
  ], [pantry("banana", 4)], { dietaryTags: [], allergens: [] }, now);
  assert.equal(ideas[0]?.recipeId, "muffin");
  assert.match(ideas[0]?.reason ?? "", /worth checking/);
});

test("keeps complete and close matches distinct without inventing pantry certainty", () => {
  const ideas = suggestPlanTogether([
    candidate({ recipeId: "complete", title: "Complete" }),
    candidate({ recipeId: "close", title: "Close", canMakeNow: false, coverage: .8, missing: ["lime"] }),
  ], [], { dietaryTags: [], allergens: [] });
  assert.match(ideas[0]?.reason ?? "", /currently says/);
  assert.match(ideas[1]?.reason ?? "", /missing lime/);
});

test("returns at most three in stable recipe-id order when scores tie", () => {
  const ideas = suggestPlanTogether(["d", "b", "a", "c"].map(id => candidate({ recipeId: id, title: id })), [], { dietaryTags: [], allergens: [] });
  assert.deepEqual(ideas.map(idea => idea.recipeId), ["a", "b", "c"]);
});

test("selected time limit rejects unknown, negative and nonfinite times without fallback", () => {
  const choices = [null, -1, NaN, Infinity, 11, 10].map((totalMinutes, index) => candidate({ recipeId: String(index), title: "Synthetic meal", totalMinutes }));
  assert.deepEqual(suggestPlanTogether(choices, [], { dietaryTags: [], allergens: [] }, undefined, 3, { maxMinutes: 10 }).map(item => item.recipeId), ["5"]);
  assert.deepEqual(suggestPlanTogether(choices.slice(0, 5), [], { dietaryTags: [], allergens: [] }, undefined, 3, { maxMinutes: 10 }), []);
});
test("saved-step limit requires positive known integer counts", () => {
  const choices = [undefined, null, 0, 1.5, 4, 3].map((stepCount, index) => candidate({ recipeId: String(index), title: "Synthetic meal", stepCount }));
  assert.deepEqual(suggestPlanTogether(choices, [], { dietaryTags: [], allergens: [] }, undefined, 3, { maxSteps: 3 }).map(item => item.recipeId), ["5"]);
});
test("no-shopping filter requires every indexed ingredient including unlisted staples", () => {
  const choices = [candidate({ recipeId: "empty", title: "No index" }), candidate({ recipeId: "staple", title: "Missing flour", ingredients: ["banana", "flour"], have: ["banana"], missing: [] }), candidate({ recipeId: "complete", title: "Banana", ingredients: ["banana"], have: ["banana"] })];
  assert.deepEqual(suggestPlanTogether(choices, [pantry("banana", 4)], { dietaryTags: [], allergens: [] }, undefined, 3, { pantryOnly: true }).map(item => item.recipeId), ["complete"]);
});
test("produce resurfacing never overrides strict dietary, allergen or time limits", () => {
  const choices = [candidate({ recipeId: "missing-tag", title: "Unknown tag", ingredients: ["banana"], have: ["banana"], totalMinutes: 5 }), candidate({ recipeId: "conflict", title: "Conflict", ingredients: ["banana", "peanut"], have: ["banana"], tags: ["vegan"], totalMinutes: 5 }), candidate({ recipeId: "slow", title: "Slow", ingredients: ["banana"], have: ["banana"], tags: ["vegan"], totalMinutes: 20 })];
  assert.deepEqual(suggestPlanTogether(choices, [pantry("banana", 4)], { dietaryTags: ["vegan"], allergens: ["peanuts"] }, new Date("2026-09-13T12:00:00.000Z"), 3, { strictDietary: true, maxMinutes: 10 }), []);
});
test("conflicting ingredient choices and missing selected pantry entry return no ideas", () => {
  const choices = [candidate({ recipeId: "banana", title: "Banana", ingredients: ["banana"] })];
  assert.deepEqual(suggestPlanTogether(choices, [], { dietaryTags: [], allergens: [] }, undefined, 3, { useIngredient: "banana", skipIngredient: "banana" }), []);
  assert.deepEqual(suggestPlanTogether(choices, [], { dietaryTags: [], allergens: [] }, undefined, 3, { pantryItem: "banana" }), []);
});
test("planning boundary rejects ambiguous duplicate, malformed and conflicting choices", () => {
  for (const query of ["maxMinutes=10&maxMinutes=60", "maxSteps=4", "pantryOnly=yes", "strictDietary=1", "useIngredient=banana,rice", "pantryItem=banana&useIngredient=rice"]) assert.throws(() => parsePlanTogetherOptions(new URLSearchParams(query)));
  for (const value of [{ maxMinutes: "10" }, { maxSteps: 0 }, { pantryOnly: "true" }, { useIngredient: ["banana"] }]) assert.throws(() => parsePlanTogetherInput(value));
  const parsed = parsePlanTogetherInput({ maxMinutes: 10, maxSteps: 3, pantryOnly: true, strictDietary: true, useIngredient: "bananas", diagnosis: "ignored synthetic field" });
  assert.equal(parsed.useIngredient, "banana"); assert.equal("diagnosis" in parsed, false);
});
