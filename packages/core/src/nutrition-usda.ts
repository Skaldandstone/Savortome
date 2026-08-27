import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { ZERO_NUTRIENTS, gramsFor, perServingNutrients, tidyNutrients } from "./nutrition.js";
import type { Ingredient, IngredientNutrition, Nutrients, RecipeNutrition } from "./recipe.js";

/**
 * Real nutrient data, for the ingredients a public food database actually
 * knows about. This is the "usda" source in every place `NutritionSource`
 * shows up — the other two are the page's own numbers and a model's guess.
 *
 * The network call here is a single search per ingredient against USDA's
 * FoodData Central, filtered to its unbranded reference data (Foundation and
 * SR Legacy) rather than a specific grocery product — a recipe's "all-purpose
 * flour" should match the generic entry, not one brand's bag of it. That
 * search response already carries nutrients per 100g, so nothing here calls
 * the food-detail endpoint; one request answers the question this needs.
 */

const FDC_SEARCH_URL = "https://api.nal.usda.gov/fdc/v1/foods/search";

/**
 * `DEMO_KEY` is api.data.gov's own public, no-signup key — real, but rate
 * limited (roughly 30 requests an hour). It's enough to develop and demo
 * against; a registered key removes the ceiling. Same shape as every other
 * "runs unconfigured, better once you configure it" integration in this app.
 */
const DEMO_KEY = "DEMO_KEY";

export interface UsdaOptions {
  apiKey?: string;
  fetch?: typeof fetch;
  /** Per-ingredient request timeout. A slow USDA response shouldn't stall an import. */
  timeoutMs?: number;
}

export const usdaConfigured = (): boolean => Boolean(process.env.USDA_FDC_API_KEY);

const NUTRIENT_MATCHERS: [keyof Nutrients, RegExp, string | null][] = [
  ["calories", /^energy$/i, "KCAL"],
  ["proteinGrams", /^protein$/i, "G"],
  ["carbGrams", /^carbohydrate/i, "G"],
  ["fatGrams", /^total lipid/i, "G"],
  ["fiberGrams", /^fiber/i, "G"],
  ["sodiumMg", /^sodium/i, "MG"],
];

interface FdcFood {
  fdcId: number;
  description: string;
  dataType: string;
  foodNutrients?: { nutrientName?: string; unitName?: string; value?: number }[];
}

/** Per-100g nutrients from a matched food's own search-result payload. */
function nutrientsPer100g(food: FdcFood): Nutrients {
  const out = { ...ZERO_NUTRIENTS };
  for (const row of food.foodNutrients ?? []) {
    const match = NUTRIENT_MATCHERS.find(
      ([, name, unit]) =>
        name.test(row.nutrientName ?? "") && (!unit || row.unitName === unit),
    );
    if (match && typeof row.value === "number") out[match[0]] = row.value;
  }
  return out;
}

export interface UsdaMatch {
  fdcId: number;
  description: string;
  /** Nutrients per 100 grams of this food, as USDA reports them. */
  per100g: Nutrients;
}

/**
 * Find the closest generic (unbranded) match for an ingredient name.
 *
 * Returns null on anything that isn't a clean win: no results, a network
 * failure, a timeout, an unparseable response. All of those are the same
 * outcome from the caller's point of view — "USDA didn't have an answer,"
 * which is exactly the condition that hands the ingredient to the model's
 * fallback estimate instead.
 */
export async function searchFood(
  canonicalItem: string,
  opts: UsdaOptions = {},
): Promise<UsdaMatch | null> {
  const fetchImpl = opts.fetch ?? fetch;
  const apiKey = opts.apiKey ?? process.env.USDA_FDC_API_KEY ?? DEMO_KEY;

  const url = new URL(FDC_SEARCH_URL);
  url.searchParams.set("query", canonicalItem);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("pageSize", "3");
  url.searchParams.set("dataType", "Foundation,SR Legacy");

  try {
    const response = await fetchImpl(url.toString(), {
      signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
    });
    if (!response.ok) return null;

    const data = (await response.json()) as { foods?: FdcFood[] };
    const food = data.foods?.[0];
    if (!food) return null;

    return { fdcId: food.fdcId, description: food.description, per100g: nutrientsPer100g(food) };
  } catch {
    // Network error, timeout, or a body that wasn't the JSON we expected —
    // all of it means "no usable answer," never a thrown error the caller
    // has to remember to catch.
    return null;
  }
}

/** Scale a per-100g reading to however many grams the recipe actually calls for. */
function scaleToGrams(per100g: Nutrients, grams: number): Nutrients {
  const factor = grams / 100;
  const out = {} as Nutrients;
  for (const key of Object.keys(per100g) as (keyof Nutrients)[]) {
    const v = per100g[key];
    out[key] = v === null ? null : v * factor;
  }
  return out;
}

export interface ComputeNutritionOptions extends UsdaOptions {
  /** Skip the network entirely — used by the manual "add nutrition" path's dry runs and tests. */
  skipUsda?: boolean;
}

/**
 * Build a recipe's nutrition, ingredient by ingredient.
 *
 * Tries USDA first for every ingredient with a usable amount; falls back to
 * the model's own guess — collected for free during extraction — for
 * anything USDA couldn't match or that has no gram-convertible amount at all.
 * An ingredient that fails both simply contributes nothing rather than a
 * fabricated number.
 */
export async function computeNutrition(
  ingredients: readonly Ingredient[],
  guesses: readonly { canonicalItem: string; contribution: Nutrients }[],
  servings: number | null,
  opts: ComputeNutritionOptions = {},
): Promise<RecipeNutrition> {
  const guessByItem = new Map(guesses.map((g) => [g.canonicalItem, g.contribution]));

  const perIngredient: IngredientNutrition[] = await Promise.all(
    ingredients.map(async (ingredient): Promise<IngredientNutrition> => {
      const grams = gramsFor(ingredient);
      const match = grams === null || opts.skipUsda ? null : await searchFood(ingredient.canonicalItem, opts);

      if (match && grams !== null) {
        return {
          canonicalItem: ingredient.canonicalItem,
          source: "usda",
          fdcId: match.fdcId,
          contribution: tidyNutrients(scaleToGrams(match.per100g, grams)),
        };
      }

      const guessed = guessByItem.get(ingredient.canonicalItem);
      return {
        canonicalItem: ingredient.canonicalItem,
        source: "estimated",
        fdcId: null,
        contribution: guessed ? tidyNutrients(guessed) : { ...ZERO_NUTRIENTS },
      };
    }),
  );

  return {
    perServing: perServingNutrients(perIngredient, servings),
    perIngredient,
    method: "computed",
  };
}

/** Re-derive `perServing` after a serving count changes, without redoing any lookup. */
export function rescaleNutrition(nutrition: RecipeNutrition, servings: number | null): RecipeNutrition {
  return { ...nutrition, perServing: perServingNutrients(nutrition.perIngredient, servings) };
}

// --- the standalone "add nutrition" path ------------------------------------

const GuessSchema = z.object({
  guesses: z.array(
    z.object({
      canonicalItem: z.string(),
      calories: z.number(),
      proteinGrams: z.number(),
      carbGrams: z.number(),
      fatGrams: z.number(),
      fiberGrams: z.number(),
      sodiumMg: z.number(),
    }),
  ),
});

/**
 * Ask the model for the same per-ingredient fallback guesses that ride along
 * for free during an AI import — except here there's no import happening to
 * ride along with, so this is the one path that pays for a small model call
 * on purpose.
 *
 * Only for a recipe that doesn't already have these: a manual recipe, one
 * imported from a page with no schema.org nutrition, or an old recipe from
 * before this feature existed. Kept intentionally cheap — a short prompt, a
 * small schema, low effort — since a rough fallback number is all this call
 * needs to produce; USDA still gets the first attempt at every ingredient.
 */
export async function guessIngredientNutrition(
  ingredients: readonly Ingredient[],
  opts: { client?: Anthropic; model?: string } = {},
): Promise<{ canonicalItem: string; contribution: Nutrients }[]> {
  if (ingredients.length === 0) return [];

  const client = opts.client ?? new Anthropic();
  const lines = ingredients
    .map((i) => `- ${i.canonicalItem}: ${i.raw || `${i.quantity ?? ""} ${i.unit ?? ""} ${i.item}`.trim()}`)
    .join("\n");

  const response = await client.messages.parse({
    model: opts.model ?? "claude-opus-5",
    max_tokens: 4_000,
    thinking: { type: "adaptive" },
    output_config: { effort: "low", format: zodOutputFormat(GuessSchema) },
    messages: [
      {
        role: "user",
        content:
          `For each ingredient below, estimate its nutritional contribution to the recipe AT THE STATED AMOUNT ` +
          `(not per 100g) — calories, protein, carbs, fat, fiber in grams, sodium in mg. Give 0 for anything ` +
          `genuinely negligible rather than skipping it. One entry per ingredient, matched by "canonicalItem" exactly ` +
          `as given.\n\n${lines}`,
      },
    ],
  });

  if (!response.parsed_output) return [];
  return response.parsed_output.guesses.map((g) => ({
    canonicalItem: g.canonicalItem,
    contribution: {
      calories: g.calories,
      proteinGrams: g.proteinGrams,
      carbGrams: g.carbGrams,
      fatGrams: g.fatGrams,
      fiberGrams: g.fiberGrams,
      sodiumMg: g.sodiumMg,
    },
  }));
}
