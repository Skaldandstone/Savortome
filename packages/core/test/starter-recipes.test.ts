import assert from "node:assert/strict";
import test from "node:test";
import { STARTER_RECIPES, STARTER_RECIPE_AUTHOR, validateDraft } from "../src/index.js";

test("starter catalogue has stable unique identities and complete recipes", () => {
  assert.equal(STARTER_RECIPES.length, 24);
  assert.equal(new Set(STARTER_RECIPES.map((recipe) => recipe.id)).size, STARTER_RECIPES.length);
  assert.equal(new Set(STARTER_RECIPES.map((recipe) => recipe.slug)).size, STARTER_RECIPES.length);
  assert.match(STARTER_RECIPE_AUTHOR.email, /@savortome\.local$/);

  for (const recipe of STARTER_RECIPES) {
    assert.doesNotThrow(() => validateDraft(recipe.draft), recipe.slug);
    assert.ok(recipe.draft.ingredients.every((ingredient) => ingredient.canonicalItem.length > 0));
    assert.deepEqual(recipe.draft.steps.map((step) => step.n), recipe.draft.steps.map((_, i) => i + 1));
    assert.ok(recipe.draft.steps.every((step) => step.text.length > 10));
  }
});

test("catalogue offers immediate, short-cook and make-ahead choices without hiding waits", () => {
  const immediate = STARTER_RECIPES.filter(recipe => recipe.draft.cookMinutes === 0 && recipe.draft.totalMinutes! <= 10);
  assert.ok(immediate.length >= 5);
  assert.ok(STARTER_RECIPES.filter(recipe => recipe.draft.totalMinutes! <= 20).length >= 8);
  const overnight = STARTER_RECIPES.find(recipe => recipe.slug === "overnight-apple-oats")!.draft;
  assert.equal(overnight.prepMinutes, 10);
  assert.ok(overnight.totalMinutes! >= 480, "overnight waiting must not rank as a ten-minute meal");
  assert.match(overnight.steps[1]!.text, /refrigerate.*8 hours/i);
  for (const { draft, slug } of STARTER_RECIPES) {
    assert.ok(draft.totalMinutes! >= draft.prepMinutes! + draft.cookMinutes!, slug);
    assert.ok(draft.equipment.length > 0, slug);
    assert.ok(draft.servings! > 0, slug);
  }
});

test("starter copy avoids medical and verified-safety claims", () => {
  const copy = JSON.stringify(STARTER_RECIPES).toLowerCase();
  for (const forbidden of ["verified safe", "allergen-free", "cures", "treats", "you need", "good source of potassium"]) {
    assert.equal(copy.includes(forbidden), false, forbidden);
  }
});
