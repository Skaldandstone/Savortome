import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { parsePantryInput } from "./pantry.js";
import { canonicalize } from "./units.js";
import {
  emitGenerationAudit,
  generatedContentSystem,
  generationAudit,
  type GenerationAuditSink,
} from "./generated-content.js";

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
  ingredients: z.array(z.string().trim().min(1).max(120)).max(50),
  /** Foods to steer away from — allergies, dislikes, "no dairy". */
  excludeIngredients: z.array(z.string().trim().min(1).max(120)).max(50),
  /** Descriptors to prefer: "vegetarian", "one-pan", "make-ahead". */
  tags: z.array(z.string().trim().min(1).max(80)).max(30),
  /** Upper bound on total time, when one is implied. "quick" is 30. */
  maxMinutes: z.number().int().min(1).max(24 * 60).nullable(),
  /** breakfast | lunch | dinner | dessert | snack | drink | side, or null. */
  course: z.enum(["breakfast", "lunch", "dinner", "dessert", "snack", "drink", "side"]).nullable(),
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
export const MAX_PANTRY_QUERY_CHARS = 1_000;

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

export const PANTRY_QUERY_PROMPT_VERSION = "savortome-pantry-query-v2";

export interface InterpretOptions {
  client?: Anthropic;
  model?: string;
  signal?: AbortSignal;
  onGenerationAudit?: GenerationAuditSink;
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
  if (text.length > MAX_PANTRY_QUERY_CHARS) {
    return {
      query: parseQueryLocally(text.slice(0, MAX_PANTRY_QUERY_CHARS)),
      interpreted: false,
      note: "That request was too long for smart search, so its first part was matched as an ingredient list.",
    };
  }
  if (!needsInterpretation(text)) {
    return { query: parseQueryLocally(text), interpreted: false };
  }

  try {
    const client = opts.client ?? new Anthropic();
    const model = opts.model ?? "claude-opus-5";
    const response = await client.messages.parse(
      {
        model,
        max_tokens: 2_000,
        system: [{
          type: "text",
          text: generatedContentSystem(SYSTEM, PANTRY_QUERY_PROMPT_VERSION),
          cache_control: { type: "ephemeral" },
        }],
        thinking: { type: "adaptive" },
        output_config: { effort: "low", format: zodOutputFormat(PantryQuerySchema) },
        messages: [{ role: "user", content: text }],
      },
      { signal: opts.signal },
    );

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      emitGenerationAudit(opts.onGenerationAudit, generationAudit(
        PANTRY_QUERY_PROMPT_VERSION, model, "pantry-query-v1", "fallback", response,
      ));
      return {
        query: parseQueryLocally(text),
        interpreted: false,
        note: "Couldn't read that as a request, so it was treated as a list of ingredients.",
      };
    }

    const validated = PantryQuerySchema.safeParse(normalize(response.parsed_output));
    if (!validated.success) {
      emitGenerationAudit(opts.onGenerationAudit, generationAudit(
        PANTRY_QUERY_PROMPT_VERSION, model, "pantry-query-v1", "fallback", response,
      ));
      return {
        query: parseQueryLocally(text),
        interpreted: false,
        note: "Smart search returned unsupported filters, so this was matched as a plain ingredient list.",
      };
    }
    emitGenerationAudit(opts.onGenerationAudit, generationAudit(
      PANTRY_QUERY_PROMPT_VERSION, model, "pantry-query-v1", "passed", response,
    ));
    return { query: validated.data, interpreted: true };
  } catch (err) {
    emitGenerationAudit(opts.onGenerationAudit, generationAudit(
      PANTRY_QUERY_PROMPT_VERSION,
      opts.model ?? "claude-opus-5",
      "pantry-query-v1",
      "fallback",
    ));
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
    course: query.course,
  };
}
