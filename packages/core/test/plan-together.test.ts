import assert from "node:assert/strict";
import test from "node:test";
import { suggestPlanTogether, type PlanTogetherCandidate } from "../src/plan-together.js";
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
