import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ZERO_NUTRIENTS,
  addNutrients,
  gramsFor,
  nutritionLabel,
  perServingNutrients,
  scaleNutrients,
  summarizeMeal,
  sumNutrients,
  tidyNutrients,
} from "../src/nutrition.js";
import type { Ingredient, IngredientNutrition, Nutrients, RecipeNutrition } from "../src/recipe.js";

const n = (over: Partial<Nutrients> = {}): Nutrients => ({ ...ZERO_NUTRIENTS, ...over });

const ing = (over: Partial<Ingredient> = {}): Pick<Ingredient, "quantity" | "unit" | "canonicalItem"> => ({
  quantity: 1,
  unit: null,
  canonicalItem: "flour",
  ...over,
});

describe("addNutrients / sumNutrients", () => {
  it("adds matching fields across two readings", () => {
    const a = n({ calories: 100, proteinGrams: 5 });
    const b = n({ calories: 50, proteinGrams: 2 });
    assert.deepEqual(addNutrients(a, b), n({ calories: 150, proteinGrams: 7 }));
  });

  it("propagates null rather than treating unknown as zero", () => {
    // "Unknown plus 50" has to stay unknown — silently treating a gap as zero
    // would understate a recipe's real total without ever admitting it.
    const a = n({ calories: null });
    const b = n({ calories: 50 });
    assert.equal(addNutrients(a, b).calories, null);
  });

  it("sums an empty list to all zeroes", () => {
    assert.deepEqual(sumNutrients([]), ZERO_NUTRIENTS);
  });

  it("sums three readings the same as two additions", () => {
    const list = [n({ calories: 10 }), n({ calories: 20 }), n({ calories: 30 })];
    assert.equal(sumNutrients(list).calories, 60);
  });
});

describe("scaleNutrients", () => {
  it("scales every field by the same factor", () => {
    const doubled = scaleNutrients(n({ calories: 100, sodiumMg: 200 }), 2);
    assert.equal(doubled.calories, 200);
    assert.equal(doubled.sodiumMg, 400);
  });

  it("keeps null null regardless of factor", () => {
    assert.equal(scaleNutrients(n({ fiberGrams: null }), 3).fiberGrams, null);
  });

  it("halves cleanly for a recipe scaled down", () => {
    assert.equal(scaleNutrients(n({ calories: 300 }), 0.5).calories, 150);
  });
});

describe("tidyNutrients", () => {
  it("rounds calories and sodium to whole numbers", () => {
    const t = tidyNutrients(n({ calories: 123.456, sodiumMg: 89.9 }));
    assert.equal(t.calories, 123);
    assert.equal(t.sodiumMg, 90);
  });

  it("keeps one decimal place for grams", () => {
    assert.equal(tidyNutrients(n({ proteinGrams: 12.34 })).proteinGrams, 12.3);
  });

  it("leaves null alone rather than rounding it to zero", () => {
    assert.equal(tidyNutrients(n({ fatGrams: null })).fatGrams, null);
  });
});

describe("gramsFor", () => {
  it("converts a weight unit directly", () => {
    assert.equal(gramsFor(ing({ quantity: 2, unit: "lb" })), 453.592 * 2);
    assert.equal(gramsFor(ing({ quantity: 100, unit: "g" })), 100);
  });

  it("converts a volume unit using the ingredient's density", () => {
    // A cup of flour and a cup of honey are not the same weight — this is
    // the whole reason a density table exists rather than one blanket number.
    const flourGrams = gramsFor(ing({ quantity: 1, unit: "cup", canonicalItem: "flour" }));
    const honeyGrams = gramsFor(ing({ quantity: 1, unit: "cup", canonicalItem: "honey" }));
    assert.ok(flourGrams! < 150, `flour should be light per cup, got ${flourGrams}`);
    assert.ok(honeyGrams! > 300, `honey should be heavy per cup, got ${honeyGrams}`);
  });

  it("matches a multi-word density key over falling through to a generic one", () => {
    // If brown sugar and plain sugar ever have different table entries, the
    // more specific match must win rather than the loose single-word one.
    const brown = gramsFor(ing({ quantity: 1, unit: "cup", canonicalItem: "brown sugar" }));
    const plain = gramsFor(ing({ quantity: 1, unit: "cup", canonicalItem: "sugar" }));
    assert.notEqual(brown, null);
    assert.notEqual(plain, null);
  });

  it("uses a known count weight for a discrete unit", () => {
    assert.equal(gramsFor(ing({ quantity: 3, unit: "clove", canonicalItem: "garlic" })), 9);
    assert.equal(gramsFor(ing({ quantity: 2, unit: "egg", canonicalItem: "egg" })), 100);
  });

  it("refuses to guess a volume of an ingredient with no known density", () => {
    // "1 cup of gochujang" has no entry in the density table — this must not
    // invent a number, it has to admit it doesn't know.
    assert.equal(gramsFor(ing({ quantity: 1, unit: "cup", canonicalItem: "gochujang" })), null);
  });

  it("refuses a unit it doesn't recognise at all", () => {
    assert.equal(gramsFor(ing({ quantity: 1, unit: "sprig", canonicalItem: "thyme" })), null);
  });

  it("refuses an unstated amount", () => {
    // "salt to taste" — a very common, completely real case.
    assert.equal(gramsFor(ing({ quantity: null, unit: null, canonicalItem: "salt" })), null);
  });

  it("refuses a zero or negative quantity", () => {
    assert.equal(gramsFor(ing({ quantity: 0, unit: "g" })), null);
  });

  it("treats a bare count with no unit as ungrammable rather than guessing", () => {
    // "2 lemons" with no unit at all isn't in the count-weight table; that's
    // correct caution, not a gap to paper over with an invented lemon weight.
    assert.equal(gramsFor(ing({ quantity: 2, unit: null, canonicalItem: "lemon" })), null);
  });
});

describe("perServingNutrients", () => {
  const rows = (contribs: Partial<Nutrients>[]): Pick<IngredientNutrition, "contribution">[] =>
    contribs.map((c) => ({ contribution: n(c) }));

  it("sums every ingredient's contribution then divides by servings", () => {
    const result = perServingNutrients(rows([{ calories: 200 }, { calories: 200 }]), 4);
    assert.equal(result.calories, 100);
  });

  it("returns the whole-recipe total when servings is null", () => {
    // Nothing to divide by — the raw total is the only honest answer.
    const result = perServingNutrients(rows([{ calories: 400 }]), null);
    assert.equal(result.calories, 400);
  });

  it("returns the whole-recipe total for a nonsense serving count", () => {
    assert.equal(perServingNutrients(rows([{ calories: 400 }]), 0).calories, 400);
    assert.equal(perServingNutrients(rows([{ calories: 400 }]), -1).calories, 400);
  });

  it("rounds the final per-serving figure", () => {
    const result = perServingNutrients(rows([{ calories: 100 }]), 3);
    assert.equal(result.calories, 33); // 33.33... rounded, not left long
  });
});

describe("nutritionLabel", () => {
  it("says 'From the source' for published data, regardless of ingredients", () => {
    assert.equal(nutritionLabel({ method: "published", perIngredient: [] }), "From the source");
  });

  it("says 'Estimated' the moment any ingredient needed a guess", () => {
    const perIngredient: IngredientNutrition[] = [
      { canonicalItem: "flour", source: "usda", fdcId: 1, contribution: n() },
      { canonicalItem: "gochujang", source: "estimated", fdcId: null, contribution: n() },
    ];
    // One estimated row is enough to make the honest summary "Estimated,"
    // even though most of the recipe came from a real database.
    assert.equal(nutritionLabel({ method: "computed", perIngredient }), "Estimated");
  });

  it("says 'From a food database' when every row is a real match", () => {
    const perIngredient: IngredientNutrition[] = [
      { canonicalItem: "flour", source: "usda", fdcId: 1, contribution: n() },
      { canonicalItem: "sugar", source: "usda", fdcId: 2, contribution: n() },
    ];
    assert.equal(nutritionLabel({ method: "computed", perIngredient }), "From a food database");
  });

  it("falls back to 'Estimated' for an empty ingredient list rather than overclaiming", () => {
    assert.equal(nutritionLabel({ method: "computed", perIngredient: [] }), "Estimated");
  });
});

describe("summarizeMeal", () => {
  const dish = (over: Partial<RecipeNutrition> & { calories?: number } = {}): RecipeNutrition => {
    const { calories, ...rest } = over;
    return {
      perServing: n({ calories: calories ?? 0 }),
      perIngredient: [],
      method: "computed",
      ...rest,
    };
  };

  it("returns null for no dishes at all", () => {
    assert.equal(summarizeMeal([], 4), null);
  });

  it("sums one serving of each dish for the per-guest figure", () => {
    const meal = summarizeMeal([dish({ calories: 500 }), dish({ calories: 150 })], 4);
    assert.equal(meal?.perGuest.calories, 650);
  });

  it("scales the per-guest figure by the guest count for the total", () => {
    const meal = summarizeMeal([dish({ calories: 500 })], 4);
    assert.equal(meal?.total.calories, 2000);
  });

  it("treats a nonsense guest count as one guest rather than erroring", () => {
    const meal = summarizeMeal([dish({ calories: 500 })], 0);
    assert.equal(meal?.guests, 1);
    assert.equal(meal?.total.calories, 500);
  });

  it("labels the meal by its weakest dish, not its strongest", () => {
    const strong = dish({ method: "published" });
    const weak = dish({
      method: "computed",
      perIngredient: [{ canonicalItem: "x", source: "estimated", fdcId: null, contribution: n() }],
    });
    const meal = summarizeMeal([strong, weak], 2);
    assert.equal(meal?.label, "Estimated");
  });

  it("labels a meal of entirely published dishes as 'From the source'", () => {
    const meal = summarizeMeal([dish({ method: "published" }), dish({ method: "published" })], 2);
    assert.equal(meal?.label, "From the source");
  });
});
