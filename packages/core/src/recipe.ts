import { z } from "zod";

/**
 * The canonical recipe shape. Everything in NomNom — hand-authored recipes,
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
] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

/** How the structured recipe was obtained. Drives the trust badge in the UI. */
export const EXTRACTION_METHODS = [
  "schema-org", // site published machine-readable JSON-LD; no model involved
  "article-llm", // page prose -> Claude
  "transcript-llm", // spoken audio -> transcript -> Claude
  "caption-llm", // post caption / description -> Claude
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
});
export type ExtractedRecipe = z.infer<typeof ExtractedRecipeSchema>;

export const RecipeSchema = ExtractedRecipeSchema.extend({
  id: z.string(),
  imageUrl: z.string().nullable(),
  source: RecipeSourceSchema,
});
export type Recipe = z.infer<typeof RecipeSchema>;
