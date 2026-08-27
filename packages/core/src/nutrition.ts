import { toBase, unitFamily } from "./units-convert.js";
import type { Ingredient, IngredientNutrition, Nutrients, RecipeNutrition } from "./recipe.js";

/**
 * The numbers, and the honesty about where they came from.
 *
 * A recipe's nutrition is built one ingredient at a time, from whichever
 * source actually had an answer for that ingredient: the page's own published
 * figures, a real USDA FoodData Central match, or — only when neither of those
 * had anything — a model's guess. Three different ingredients in the same
 * recipe can come from three different sources, and the label on the finished
 * number has to say the truth about the weakest one, not the best one.
 *
 * Nothing here is a lab result. The same ingredient varies by brand, cut, and
 * prep in ways no lookup or model can see, and the recipe's own stated amount
 * is itself a cook's estimate before any of this even starts. This is a
 * kitchen-scale guess, sized to be useful for planning a meal — not medical or
 * dietary advice, and never presented as more certain than it is.
 */

/** All six figures, or none — a partial reading isn't worth half-showing. */
export const ZERO_NUTRIENTS: Nutrients = {
  calories: 0,
  proteinGrams: 0,
  carbGrams: 0,
  fatGrams: 0,
  fiberGrams: 0,
  sodiumMg: 0,
};

const NUTRIENT_KEYS = Object.keys(ZERO_NUTRIENTS) as (keyof Nutrients)[];

/** Add two readings. Null propagates — "unknown plus anything is unknown," not zero. */
export function addNutrients(a: Nutrients, b: Nutrients): Nutrients {
  const out = {} as Nutrients;
  for (const key of NUTRIENT_KEYS) {
    const x = a[key];
    const y = b[key];
    out[key] = x === null || y === null ? null : x + y;
  }
  return out;
}

export function sumNutrients(list: readonly Nutrients[]): Nutrients {
  return list.reduce(addNutrients, ZERO_NUTRIENTS);
}

/**
 * Scale a reading by a factor — the same serving-size slider that already
 * scales quantities. Reused rather than reimplemented so "double this recipe"
 * means the same thing to the ingredient list and the calorie count.
 */
export function scaleNutrients(n: Nutrients, factor: number): Nutrients {
  const out = {} as Nutrients;
  for (const key of NUTRIENT_KEYS) {
    const v = n[key];
    out[key] = v === null ? null : v * factor;
  }
  return out;
}

const round = (n: number): number => Math.round(n * 10) / 10;

/** Nutrients rounded to something worth printing — a tenth of a gram is noise. */
export function tidyNutrients(n: Nutrients): Nutrients {
  const out = {} as Nutrients;
  for (const key of NUTRIENT_KEYS) {
    const v = n[key];
    out[key] = v === null ? null : key === "calories" || key === "sodiumMg" ? Math.round(v) : round(v);
  }
  return out;
}

/**
 * Which source label to show for a finished recipe's nutrition.
 *
 * The one shared home for this language, so five screens don't each invent
 * their own wording and drift — "approximate" on one, "estimated" on another,
 * nothing on a third. Named for the weakest ingredient in the recipe: one
 * estimated row makes the whole card "Estimated," because that's the honest
 * summary of what a cook is looking at.
 */
export function nutritionLabel(nutrition: Pick<RecipeNutrition, "method" | "perIngredient">): string {
  if (nutrition.method === "published") return "From the source";
  const sources = new Set(nutrition.perIngredient.map((i) => i.source));
  if (sources.has("estimated")) return "Estimated";
  if (sources.has("usda")) return "From a food database";
  return "Estimated";
}

/** The caveat that belongs next to every nutrition figure in the app, once. */
export const NUTRITION_DISCLAIMER =
  "A kitchen-scale guess from the recipe's own ingredients, not a lab result — not medical or dietary advice.";

// --- gram conversion ---------------------------------------------------------

/**
 * Grams per unit for the household counts a lookup can't weigh on its own —
 * "1 clove," "2 eggs," a can, a stick of butter. Deliberately small: anything
 * not listed here falls through to the model's estimate rather than getting a
 * confident wrong number from a guessed weight.
 */
const COUNT_WEIGHTS: Record<string, number> = {
  clove: 3,
  egg: 50,
  stick: 113, // a stick of butter
  slice: 28,
  can: 400,
  head: 500, // lettuce, cabbage, garlic all vary wildly; a rough middle
};

/**
 * Grams per millilitre for the volume-measured ingredients that show up
 * constantly in recipes. A cup of flour and a cup of honey are not the same
 * weight, which is exactly why the shopping list never merges a volume and a
 * weight of the same thing — this table exists only to get from "the recipe's
 * own amount" to "grams for a nutrient lookup," not to make that merge safe
 * anywhere else in the app.
 *
 * Matched by the canonical item containing the key as a whole word, most
 * specific first, so "brown sugar" doesn't fall through to plain "sugar" and
 * "olive oil" doesn't fall through to plain "oil" if their densities ever
 * diverge enough to matter.
 */
const DENSITY_G_PER_ML: [string, number][] = [
  ["honey", 1.42],
  ["brown sugar", 0.93],
  ["sugar", 0.85],
  ["butter", 0.96],
  ["oil", 0.92],
  ["milk", 1.03],
  ["water", 1.0],
  ["flour", 0.53],
  ["rice", 0.78],
  ["cream", 1.0],
  ["yogurt", 1.03],
];

function densityFor(canonicalItem: string): number | null {
  const words = new Set(canonicalItem.toLowerCase().split(/\s+/));
  for (const [key, density] of DENSITY_G_PER_ML) {
    if (key.includes(" ") ? canonicalItem.includes(key) : words.has(key)) return density;
  }
  return null;
}

/**
 * Convert an ingredient's stated amount to grams, or admit it can't be done.
 *
 * Returning null is the correct answer far more often than guessing: "a pinch
 * of salt," "salt to taste," and a unit this table has never heard of are all
 * real recipes, and every one of them should fall through to the model's
 * estimate rather than being weighed with a number invented for the occasion.
 */
export function gramsFor(
  ingredient: Pick<Ingredient, "quantity" | "unit" | "canonicalItem">,
): number | null {
  if (ingredient.quantity === null || ingredient.quantity <= 0) return null;

  const family = unitFamily(ingredient.unit);
  if (family === "weight") return toBase(ingredient.quantity, ingredient.unit);

  if (family === "volume") {
    const ml = toBase(ingredient.quantity, ingredient.unit);
    const density = ml === null ? null : densityFor(ingredient.canonicalItem);
    return ml === null || density === null ? null : ml * density;
  }

  // A bare unit, or a discrete one this app doesn't otherwise convert —
  // "2 eggs," "3 cloves garlic," "1 can." Only the ones with a known weight
  // are usable; everything else stays null rather than assumed.
  const unit = (ingredient.unit ?? "").toLowerCase();
  const perUnit = COUNT_WEIGHTS[unit];
  return perUnit === undefined ? null : ingredient.quantity * perUnit;
}

/**
 * The per-serving figure a screen actually renders.
 *
 * `perIngredient` already holds each ingredient's contribution to the whole
 * recipe; dividing by servings is the only arithmetic left, and it's the same
 * division the rest of the app already does for a serving count.
 */
export function perServingNutrients(
  perIngredient: readonly Pick<IngredientNutrition, "contribution">[],
  servings: number | null,
): Nutrients {
  const total = sumNutrients(perIngredient.map((i) => i.contribution));
  if (!servings || servings <= 0) return total;
  return tidyNutrients(scaleNutrients(total, 1 / servings));
}
