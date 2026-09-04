import { z } from "zod";

/**
 * The canonical recipe shape. Everything in Second Breakfast — hand-authored recipes,
 * blog scrapes, and recipes reconstructed from a spoken-word video — lands here.
 * The extractor, the database, and both clients all agree on this one schema.
 */

export const SOURCE_KINDS = [
  "youtube",
  "tiktok",
  "instagram",
  "facebook",
  "web",
  "manual",
  "text",
  "photo",
] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

/** How the structured recipe was obtained. Drives the trust badge in the UI. */
export const EXTRACTION_METHODS = [
  "schema-org", // site published machine-readable JSON-LD; no model involved
  "article-llm", // page prose -> Claude
  "transcript-llm", // spoken audio -> transcript -> Claude
  "caption-llm", // post caption / description -> Claude
  "photo-llm", // a photographed page -> Claude, read directly as an image
  "manual", // typed by a human
] as const;
export type ExtractionMethod = (typeof EXTRACTION_METHODS)[number];

export const IngredientSchema = z.object({
  /** Verbatim line as written or spoken, kept so the user can always audit us. */
  raw: z.string(),
  /** Numeric amount, decimalized ("1 1/2" -> 1.5). Null when unstated ("salt to taste"). */
  quantity: z.number().nullable(),
  /** Upper bound when the source gives a range ("2-3 cloves" -> quantity 2, quantityMax 3). */
  quantityMax: z.number().nullable(),
  /** Unit as written: cup, tbsp, g, oz, clove, can, pinch. Null for bare counts. */
  unit: z.string().nullable(),
  /** The food itself, without amount or prep. "yellow onion", not "1 large yellow onion, diced". */
  item: z.string(),
  /** Lowercase singular form used for pantry matching and shopping-list merging. */
  canonicalItem: z.string(),
  /** Prep or qualifier: "finely diced", "room temperature", "divided". */
  notes: z.string().nullable(),
  optional: z.boolean(),
  /** Sub-recipe heading this belongs under, e.g. "For the sauce". */
  group: z.string().nullable(),
});
export type Ingredient = z.infer<typeof IngredientSchema>;

export const StepSchema = z.object({
  n: z.number().int(),
  text: z.string(),
  /** Hands-off duration the step implies, for in-app timers. */
  timerSeconds: z.number().int().nullable(),
  /** Seconds into the source video where this step is demonstrated. */
  sourceTimestamp: z.number().int().nullable(),
});
export type Step = z.infer<typeof StepSchema>;

/** The six figures every nutrition-showing screen in the app agrees on. */
export const NutrientsSchema = z.object({
  calories: z.number().nullable(),
  proteinGrams: z.number().nullable(),
  carbGrams: z.number().nullable(),
  fatGrams: z.number().nullable(),
  fiberGrams: z.number().nullable(),
  sodiumMg: z.number().nullable(),
});
export type Nutrients = z.infer<typeof NutrientsSchema>;

/** Where one ingredient's nutrition came from — see nutrition.ts for what each means. */
export const NUTRITION_SOURCES = ["published", "usda", "estimated"] as const;
export type NutritionSource = (typeof NUTRITION_SOURCES)[number];

export const IngredientNutritionSchema = z.object({
  canonicalItem: z.string(),
  source: z.enum(NUTRITION_SOURCES),
  /** Set only when source is "usda" — which FoodData Central entry matched. */
  fdcId: z.number().nullable(),
  /** This ingredient's share of the whole recipe, at the amount it's used in — not per 100g. */
  contribution: NutrientsSchema,
});
export type IngredientNutrition = z.infer<typeof IngredientNutritionSchema>;

export const RecipeNutritionSchema = z.object({
  perServing: NutrientsSchema,
  perIngredient: z.array(IngredientNutritionSchema),
  /**
   * "published" when the source's own schema.org data supplied the numbers
   * whole; "computed" when this app built them ingredient by ingredient,
   * whatever mix of usda/estimated rows that involved.
   */
  method: z.enum(["published", "computed"]),
});
export type RecipeNutrition = z.infer<typeof RecipeNutritionSchema>;

export const RecipeSourceSchema = z.object({
  kind: z.enum(SOURCE_KINDS),
  url: z.string().nullable(),
  /** Creator / site / channel name. */
  author: z.string().nullable(),
  siteName: z.string().nullable(),
  extractionMethod: z.enum(EXTRACTION_METHODS),
});
export type RecipeSource = z.infer<typeof RecipeSourceSchema>;

/**
 * What the model is asked to produce. Deliberately excludes ids, timestamps,
 * and anything the server owns — see `RecipeSchema` for the persisted shape.
 */
export const ExtractedRecipeSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  servings: z.number().nullable(),
  servingsNote: z.string().nullable(),
  prepMinutes: z.number().int().nullable(),
  cookMinutes: z.number().int().nullable(),
  totalMinutes: z.number().int().nullable(),
  ingredients: z.array(IngredientSchema),
  steps: z.array(StepSchema),
  equipment: z.array(z.string()),
  /** Free-form descriptors: "weeknight", "one-pan", "vegetarian", "high-protein". */
  tags: z.array(z.string()),
  cuisine: z.string().nullable(),
  /** breakfast | lunch | dinner | dessert | snack | drink | side | sauce | ... */
  course: z.string().nullable(),
  difficulty: z.enum(["easy", "medium", "hard"]).nullable(),
  /** 0-1. How much of the recipe was actually stated vs. inferred by the model. */
  confidence: z.number(),
  /** Anything guessed, ambiguous, or missing — surfaced to the user for review. */
  extractionNotes: z.array(z.string()),
  /**
   * The model's own best guess at each ingredient's nutritional contribution,
   * at the amount actually used in this recipe — not a lookup, just what falls
   * out of reading the ingredient list anyway. This is a fallback, not the
   * answer: the ingest pipeline prefers a real USDA FoodData Central match for
   * every ingredient it can, and only keeps a row from here when that lookup
   * couldn't find or convert the ingredient. Riding along in this same call is
   * what keeps that fallback free — there is no second model call for it.
   *
   * Every figure here is a plain number, never null — the prompt asks for 0
   * on anything genuinely negligible instead. That isn't a style choice: six
   * more nullable fields on top of everything else in this schema is what
   * pushed a real extraction request over the API's cap on how many nullable
   * or union-typed parameters one structured-output schema may contain.
   */
  ingredientNutritionGuesses: z.array(
    z.object({
      canonicalItem: z.string(),
      contribution: z.object({
        calories: z.number(),
        proteinGrams: z.number(),
        carbGrams: z.number(),
        fatGrams: z.number(),
        fiberGrams: z.number(),
        sodiumMg: z.number(),
      }),
    }),
  ),
});
export type ExtractedRecipe = z.infer<typeof ExtractedRecipeSchema>;

export const RecipeSchema = ExtractedRecipeSchema.extend({
  id: z.string(),
  imageUrl: z.string().nullable(),
  source: RecipeSourceSchema,
  /**
   * Null until something has computed it — an old recipe, or one that hasn't
   * been backfilled yet, simply has none. Never invented lazily at render
   * time; see the ingest pipeline and the "add nutrition" action for the only
   * two places this gets filled in.
   */
  nutrition: RecipeNutritionSchema.nullable(),
});
export type Recipe = z.infer<typeof RecipeSchema>;
