import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ExtractedRecipeSchema, type ExtractedRecipe } from "./recipe.js";

/**
 * The guess schema's contribution fields are plain numbers, not the nullable
 * `Nutrients` shape the rest of the app uses — see the schema comment for why.
 * A backfilled placeholder needs the same non-nullable shape.
 */
const ZERO_CONTRIBUTION = {
  calories: 0,
  proteinGrams: 0,
  carbGrams: 0,
  fatGrams: 0,
  fiberGrams: 0,
  sodiumMg: 0,
};
import { canonicalize } from "./units.js";
import type { SourceDocument } from "./sources/types.js";

export const EXTRACTION_MODEL = "claude-opus-5";

/**
 * Frozen system prompt. Kept byte-stable and cached so every ingest after the
 * first pays the cached-input rate for it.
 */
const SYSTEM = `You turn messy real-world cooking content into one precise, cookable recipe card.

You will be given text from one of four places: a food blog article, an auto-generated video transcript, a social post caption, or raw pasted text. Your job is always the same — recover the recipe the author actually intends, and be explicit about what you had to infer.

RULES

Ingredients
- One entry per distinct ingredient. Never merge two foods into one line.
- "raw" is the source's own wording, cleaned of markup but not reworded.
- "quantity" is decimal: "1 1/2" becomes 1.5, "a couple" becomes 2, "a few" becomes 3. Use null when genuinely unstated ("salt to taste"), not 0.
- "quantityMax" only for explicit ranges ("2-3 cloves" becomes quantity 2, quantityMax 3). Otherwise null.
- "unit" uses these canonical forms where they apply: tsp, tbsp, cup, floz, oz, lb, g, kg, ml, l, pinch, dash, clove, can, jar, package, bunch, sprig, slice, stick, head, stalk, quart, pint, gallon. Bare counts ("2 eggs") take unit null. Keep an unusual unit verbatim rather than forcing a wrong match.
- "item" is the food alone — no amount, no prep, no brand. "1 large yellow onion, finely diced" gives item "yellow onion" and notes "finely diced".
- "canonicalItem" is "item" lowercased, singularized, with size and prep words removed: "yellow onion", "chicken thigh", "all-purpose flour". This is what the pantry matcher and shopping list join on, so keep it plain and consistent.
- Set "optional" true for anything the source marks optional, "if you like", or "for serving".
- "group" is the sub-recipe heading ("For the marinade") or null.
- Ingredients used in a step but never listed still get an entry, with an extractionNote saying the amount was inferred.

Steps
- Number from 1, in cooking order — not the order things were said.
- Each step is one coherent action or a tight cluster of actions. Merge filler; split a step that hides three distinct operations.
- Write imperative, second-person prose. Strip sponsorships, "smash that like button", tangents, and life stories.
- Carry over any temperature, time, visual doneness cue, or pan size that was mentioned. These are the details people actually need and they are the first thing sloppy extraction drops.
- "timerSeconds" is the hands-off duration the step implies, or null. For a range, use the midpoint.
- "sourceTimestamp": when the input has [mm:ss] markers, set this to the second the step begins. Otherwise null.

Times, yield, metadata
- Only fill prepMinutes, cookMinutes, and totalMinutes from what is stated or clearly implied by the step durations. Do not invent a total.
- "servings" is a number; put the source's own phrasing in "servingsNote" ("serves 4-6 as a side").
- "tags" are lowercase and useful for browsing: dietary ("vegetarian", "gluten-free"), effort ("weeknight", "make-ahead"), method ("one-pan", "grilled", "no-bake"). 3-8 of them. No hashtag punctuation.
- "equipment" only for things a normal kitchen might lack: stand mixer, food processor, Dutch oven, thermometer, air fryer.

Nutrition
- "ingredientNutritionGuesses" is your best estimate of each ingredient's nutritional contribution to this recipe AS USED — at the amount actually called for, not per 100g. One entry per ingredient in the ingredients list, matched by the same "canonicalItem" string.
- This is a fallback of last resort, used only for the ingredients a real food database can't identify — an unusual product, a regional dish, a garnish with no clean database entry. Give your honest best guess anyway; a rough number the app can label "estimated" is more useful than an empty one.
- Give 0 rather than null for calories/protein/carbGrams/fatGrams/fiberGrams/sodiumMg you're confident is genuinely negligible (a pinch of salt's calories), and your best nonzero guess otherwise. Never skip an ingredient.

Honesty
- "confidence" is the fraction of the recipe that was actually stated rather than inferred by you. A clean blog recipe card is 0.95+. A rambling transcript where you reconstructed half the amounts is 0.5-0.7. Be strict; users trust this number to decide whether to double-check.
- "extractionNotes" records every guess, ambiguity, and gap in plain language a cook can act on: "Oil amount was never stated; estimated 2 tbsp." / "Oven temperature not mentioned." / "Speaker mentions a sauce but never lists its ingredients." Empty array only when nothing was inferred.
- Never invent a step, a temperature, or an ingredient to make the recipe look complete. A gap plus a note is correct; a plausible fabrication is not.

If the text contains no recipe at all, return title "No recipe found", empty ingredients and steps, confidence 0, and one extractionNote explaining what the text was instead.`;

const GUIDANCE: Record<SourceDocument["textKind"], string> = {
  article: `This is a food blog page, scraped whole. Most of it is narrative, ads, comments, and navigation. Find the recipe and ignore the rest. If the page has both a chatty walkthrough and a structured recipe card, the card is authoritative for amounts, but pull temperatures, pan sizes, and doneness cues from the narrative when the card omits them.`,

  transcript: `This is an auto-generated transcript of someone cooking on camera, with [mm:ss] timestamps. Expect: unreliable punctuation, misheard food words ("cardamom" as "card of mom", "roux" as "rue"), amounts given by gesture ("about this much"), ingredients introduced mid-step, and steps described out of order or revisited later. Reconstruct the intended recipe. Correct obvious mistranscriptions of food terms silently. When an amount is only gestured at, estimate a sensible one and log it in extractionNotes. Set sourceTimestamp on every step from the nearest preceding marker.`,

  caption: `This is the caption or description attached to a short video post. It is often the most reliable part of the post — creators put the real ingredient list here because the video moves too fast to follow. It may be terse, emoji-heavy, and use line breaks instead of punctuation. Strip hashtags, handles, and promo links. If the method is only sketched, write the steps at the level of detail the caption supports and note the thinness rather than padding it out.`,

  raw: `This is text the user pasted in directly. It may be a complete recipe, a screenshot transcription, or a fragment.`,
};

export interface ExtractOptions {
  client?: Anthropic;
  model?: string;
  /**
   * "low" for cheap re-runs, "medium" (default) for everything else.
   *
   * Measured against a messy video transcript, "high" cost 29% more than
   * "medium" for no quality gain — same ingredient/step counts, and actually
   * a *lower* confidence score. Raise per-call only if a specific source
   * shape is shown to need it; don't reach for "high" as a default guess.
   */
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  signal?: AbortSignal;
}

export class ExtractionError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

/** Belt-and-braces: the model is asked for these invariants, but the app relies on them. */
function normalize(recipe: ExtractedRecipe): ExtractedRecipe {
  return {
    ...recipe,
    ingredients: recipe.ingredients.map((ing) => ({
      ...ing,
      canonicalItem: ing.canonicalItem?.trim()
        ? canonicalize(ing.canonicalItem)
        : canonicalize(ing.item),
    })),
    steps: recipe.steps.map((s, i) => ({ ...s, n: i + 1 })),
    tags: [
      ...new Set(recipe.tags.map((t) => t.toLowerCase().replace(/^#/, "").trim())),
    ].filter(Boolean),
    confidence: Math.min(1, Math.max(0, recipe.confidence)),
    // Belt-and-braces, same as canonicalItem above: the model is asked for one
    // guess per ingredient, but a missing row shouldn't be a missing lookup
    // fallback later — it becomes a zero-contribution guess instead.
    ingredientNutritionGuesses: recipe.ingredients.map((ing) => {
      const existing = recipe.ingredientNutritionGuesses.find(
        (g) => g.canonicalItem === ing.canonicalItem,
      );
      return existing ?? { canonicalItem: ing.canonicalItem, contribution: { ...ZERO_CONTRIBUTION } };
    }),
  };
}

export async function extractRecipe(
  doc: SourceDocument,
  opts: ExtractOptions = {},
): Promise<ExtractedRecipe> {
  const client = opts.client ?? new Anthropic();

  const header = [
    doc.title ? `Title: ${doc.title}` : null,
    doc.author ? `Creator: ${doc.author}` : null,
    doc.siteName ? `Source: ${doc.siteName}` : null,
    doc.url ? `URL: ${doc.url}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.messages.parse(
    {
      model: opts.model ?? EXTRACTION_MODEL,
      max_tokens: 16_000,
      // 1h TTL: imports across the whole app arrive scattered, rarely two
      // within the default 5-minute window. A longer-lived cache is what
      // actually gets hit in practice, not a hypothetical burst.
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral", ttl: "1h" } }],
      thinking: { type: "adaptive" },
      output_config: {
        effort: opts.effort ?? "medium",
        format: zodOutputFormat(ExtractedRecipeSchema),
      },
      messages: [
        {
          role: "user",
          content: `${GUIDANCE[doc.textKind]}\n\n${header}\n\n--- CONTENT ---\n${doc.text}`,
        },
      ],
    },
    { signal: opts.signal },
  );

  if (response.stop_reason === "refusal") {
    throw new ExtractionError(
      `The model declined to process this content (${response.stop_details?.category ?? "unspecified"}). ` +
        `If this is an ordinary recipe, try pasting the text directly.`,
    );
  }
  if (!response.parsed_output) {
    throw new ExtractionError(
      "The model did not return a parseable recipe. Try re-running the import.",
    );
  }

  return normalize(response.parsed_output);
}
