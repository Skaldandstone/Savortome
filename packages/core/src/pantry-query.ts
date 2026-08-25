import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { parsePantryInput } from "./pantry.js";
import { canonicalize } from "./units.js";

/**
 * Turning "what can I make?" into something the matcher can run.
 *
 * A plain list of ingredients needs no model at all — it goes through the same
 * parser the importer uses. A query with constraints in it ("something quick
 * and vegetarian with the chicken thighs I've got") does, so that path calls
 * Claude and falls back to the deterministic one when no key is configured.
 */

export const PantryQuerySchema = z.object({
  /** Foods the cook has, lowercase singular: "chicken thigh", "yellow onion". */
  ingredients: z.array(z.string()),
  /** Foods to steer away from — allergies, dislikes, "no dairy". */
  excludeIngredients: z.array(z.string()),
  /** Descriptors to prefer: "vegetarian", "one-pan", "make-ahead". */
  tags: z.array(z.string()),
  /** Upper bound on total time, when one is implied. "quick" is 30. */
  maxMinutes: z.number().int().nullable(),
  /** breakfast | lunch | dinner | dessert | snack | drink | side, or null. */
  course: z.string().nullable(),
});

export type PantryQuery = z.infer<typeof PantryQuerySchema>;

export const EMPTY_QUERY: PantryQuery = {
  ingredients: [],
  excludeIngredients: [],
  tags: [],
  maxMinutes: null,
  course: null,
};

const CONSTRAINT_HINTS =
  /\b(quick|fast|easy|slow|healthy|light|hearty|vegetarian|vegan|gluten|dairy|keto|low[- ]carb|without|no |avoid|under|less than|minutes?|mins?|hours?|breakfast|lunch|dinner|dessert|snack|side|one[- ](pan|pot)|make[- ]ahead|freezer|kid|leftover)\b/i;

/**
 * Does this read like a sentence with conditions, or just a list of food?
 * A list is cheaper and more predictable to handle directly.
 */
export function needsInterpretation(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (CONSTRAINT_HINTS.test(trimmed)) return true;
  // Commas mean a list; lots of words without them mean prose.
  return !trimmed.includes(",") && trimmed.split(/\s+/).length > 6;
}

/** The no-model path: everything typed is treated as an ingredient. */
export function parseQueryLocally(text: string): PantryQuery {
  return { ...EMPTY_QUERY, ingredients: parsePantryInput(text).map((e) => e.canonicalItem) };
}

const SYSTEM = `You turn a home cook's plain-language request into search filters over their own recipe collection.

Extract only what the request actually says. This drives a database query, so an invented filter silently hides recipes the cook wanted to see.

- "ingredients" is what they have or want to use, as lowercase singular canonical names: "chicken thigh", "yellow onion", "all-purpose flour". Strip amounts, brands, and prep.
- "excludeIngredients" is what to avoid — allergies, dislikes, "no dairy", "without nuts". Same naming.
- "tags" are descriptors worth filtering on: dietary ("vegetarian", "gluten-free"), effort ("weeknight", "make-ahead"), method ("one-pan", "no-bake"). Lowercase. Leave empty rather than guessing.
- "maxMinutes" only when time is implied. "quick" or "fast" is 30. "30 minutes or less" is 30. Otherwise null.
- "course" only when stated or unmistakable: breakfast, lunch, dinner, dessert, snack, drink, side. Otherwise null.

If the request is nothing but a list of foods, put them all in "ingredients" and leave everything else empty.`;

export interface InterpretOptions {
  client?: Anthropic;
  model?: string;
  signal?: AbortSignal;
}

/**
 * Interpret a natural-language pantry query. Falls back to the local parser
 * when the model is unavailable — a search that works less cleverly beats a
 * search that errors.
 */
export async function interpretPantryQuery(
  text: string,
  opts: InterpretOptions = {},
): Promise<{ query: PantryQuery; interpreted: boolean; note?: string }> {
  if (!needsInterpretation(text)) {
    return { query: parseQueryLocally(text), interpreted: false };
  }

  try {
    const client = opts.client ?? new Anthropic();
    const response = await client.messages.parse(
      {
        model: opts.model ?? "claude-opus-5",
        max_tokens: 2_000,
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        thinking: { type: "adaptive" },
        output_config: { effort: "low", format: zodOutputFormat(PantryQuerySchema) },
        messages: [{ role: "user", content: text }],
      },
      { signal: opts.signal },
    );

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return {
        query: parseQueryLocally(text),
        interpreted: false,
        note: "Couldn't read that as a request, so it was treated as a list of ingredients.",
      };
    }

    return { query: normalize(response.parsed_output), interpreted: true };
  } catch (err) {
    // No key, no network, rate limited — none of that should break search.
    return {
      query: parseQueryLocally(text),
      interpreted: false,
      note:
        err instanceof Error && /authentication method/i.test(err.message)
          ? "No Anthropic API key is set, so this was matched as a plain ingredient list."
          : "Smart search was unavailable, so this was matched as a plain ingredient list.",
    };
  }
}

/** Force the model's output into the same naming the ingredient index uses. */
function normalize(query: PantryQuery): PantryQuery {
  const clean = (items: string[]) =>
    [...new Set(items.map((i) => canonicalize(i)).filter(Boolean))];

  return {
    ingredients: clean(query.ingredients),
    excludeIngredients: clean(query.excludeIngredients),
    tags: [...new Set(query.tags.map((t) => t.toLowerCase().replace(/^#/, "").trim()))].filter(
      Boolean,
    ),
    maxMinutes: query.maxMinutes && query.maxMinutes > 0 ? query.maxMinutes : null,
    course: query.course?.toLowerCase().trim() || null,
  };
}
