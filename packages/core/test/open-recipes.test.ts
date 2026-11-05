import assert from "node:assert/strict";
import test from "node:test";
import { findOpenRecipe, OPEN_RECIPE_LIBRARY, searchOpenRecipes } from "../src/open-recipes.js";

test("open recipes retain unique identity, attribution and usable source sections", () => {
  const recipes = OPEN_RECIPE_LIBRARY.recipes;
  assert.ok(recipes.length > 3000);
  assert.equal(new Set(recipes.map(recipe => recipe.id)).size, recipes.length);
  assert.equal(new Set(recipes.map(recipe => recipe.sourceUrl)).size, recipes.length);
  for (const recipe of recipes) {
    const url = new URL(recipe.sourceUrl);
    assert.equal(url.origin, "https://en.wikibooks.org");
    assert.ok(url.pathname.startsWith("/wiki/Cookbook:"));
    assert.equal(recipe.license, "CC-BY-SA-4.0");
    assert.ok(recipe.attribution.includes(recipe.sourceUrl));
    assert.ok(recipe.modifications.length > 0);
    assert.ok(recipe.ingredients.length >= 2);
    assert.ok(recipe.steps.length >= 1);
    assert.equal(recipe.reviewStatus, "structurally-validated-not-cooking-tested");
  }
});

test("search matches all terms, bounds pages and returns recoverable empty results", () => {
  const result = searchOpenRecipes("chicken rice");
  assert.ok(result.total > 0);
  assert.ok(result.recipes.length <= 24);
  for (const recipe of result.recipes) {
    const text = [recipe.title, ...recipe.ingredients].join(" ").toLowerCase();
    assert.ok(text.includes("chicken") && text.includes("rice"));
    assert.equal(findOpenRecipe(recipe.id), recipe);
  }
  assert.equal(searchOpenRecipes("", -1).page, 1);
  assert.equal(searchOpenRecipes("", Infinity).page, 1);
  const last = searchOpenRecipes("", Number.MAX_SAFE_INTEGER);
  assert.equal(last.page, last.pages);
  const empty = searchOpenRecipes("zznonexistentingredientzz");
  assert.equal(empty.total, 0);
  assert.equal(empty.page, 1);
  assert.equal(empty.pages, 1);
  assert.equal(findOpenRecipe("missing"), undefined);
});
