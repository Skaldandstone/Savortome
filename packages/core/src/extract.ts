import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ExtractedRecipeSchema, MAX_PHOTO_BASE64_CHARS, type ExtractedRecipe } from "./recipe.js";
import {
  emitGenerationAudit,
  generatedContentSystem,
  generationAudit,
  sanitizeGeneratedText,
  type GenerationAuditSink,
} from "./generated-content.js";

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
export const EXTRACTION_PROMPT_VERSION = "savortome-recipe-extraction-v2";
export const MAX_GENERATION_SOURCE_TEXT_CHARS = 250_000;

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
- "timerSeconds" is the HANDS-OFF duration the step implies, or null. For a range, use the midpoint. This is time the cook is not working: a simmer, a rest, a proof, time in the oven.
- "activeSeconds" is the HANDS-ON time the step takes at an average pace, or null. These are different numbers and must never be merged. "Simmer 20 minutes, stirring occasionally" is timerSeconds 1200 and activeSeconds around 120. A step that is purely waiting has activeSeconds null; a step that is purely work has timerSeconds null.
- "demands" is the one skill the step mostly leans on, or null: "knife" for chopping, dicing, breaking down meat; "stovetop" for heat control, searing, emulsions that can split; "oven" for baking, pastry, anything that rises or must come out at the right moment; "timing" for steps that require juggling several things at once. Null when the step asks nothing in particular - stirring, waiting, putting a lid on.
- "sourceTimestamp": when the input has [mm:ss] markers, set this to the second the step begins. Otherwise null.

Times, yield, metadata
- Only fill prepMinutes, cookMinutes, and totalMinutes from what is stated or clearly implied by the step durations. Do not invent a total.
- "servings" is a number; put the source's own phrasing in "servingsNote" ("serves 4-6 as a side").
- "tags" are lowercase and useful for browsing: dietary ("vegetarian", "gluten-free"), effort ("weeknight", "make-ahead"), method ("one-pan", "grilled", "no-bake"). 3-8 of them. No hashtag punctuation.
- "equipment" only for things a normal kitchen might lack: stand mixer, food processor, Dutch oven, thermometer, air fryer. Mark anything the source presents as optional by writing "(optional)" after it, so a missing one never stops someone cooking.
- "skillDemands" rates what the recipe asks of the cook, 1 to 5, on each of knife, stovetop, oven and timing. 1 is "anyone can do this the first time", 3 is "a confident home cook", 5 is "years of practice". Use null for a skill the recipe genuinely does not lean on - a no-bake slice asks nothing of "oven", and a traybake asks nothing of "knife". Rate the recipe's hardest moment on each skill, not its average: one emulsion in an otherwise simple dish still makes "stovetop" a 4. Be honest rather than generous. These numbers decide whether someone is shown a recipe as an ordinary suggestion or as a challenge, so inflating them hides good recipes from people who could cook them, and deflating them sets people up to fail.

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

  photo: `This is a photograph of a physical page — a recipe card, a cookbook spread, a handwritten note, a magazine clipping. Read it directly; there is no transcript. Expect: glare or shadow across part of the page, a slight tilt or crop, handwriting of varying legibility, multi-column layouts where ingredients and steps interleave visually rather than in reading order, and marginal notes (a substitution, a doubled amount, "add more next time") that belong in extractionNotes rather than the main recipe. If a word is genuinely illegible, say so in extractionNotes rather than guessing silently. If the photo shows no recipe at all — a random object, a blank page, something unreadable — say so per the "no recipe" rule below rather than fabricating one.`,
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
  onGenerationAudit?: GenerationAuditSink;
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
  const ingredients = recipe.ingredients.map((ing) => ({
    ...ing,
    raw: sanitizeGeneratedText(ing.raw, 2_000),
    unit: ing.unit ? sanitizeGeneratedText(ing.unit, 80) || null : null,
    item: sanitizeGeneratedText(ing.item, 240),
    canonicalItem: ing.canonicalItem?.trim()
      ? canonicalize(ing.canonicalItem)
      : canonicalize(ing.item),
    notes: ing.notes ? sanitizeGeneratedText(ing.notes, 500) || null : null,
    group: ing.group ? sanitizeGeneratedText(ing.group, 160) || null : null,
  }));
  return {
    ...recipe,
    title: sanitizeGeneratedText(recipe.title, 240),
    description: recipe.description ? sanitizeGeneratedText(recipe.description, 2_000) || null : null,
    servingsNote: recipe.servingsNote ? sanitizeGeneratedText(recipe.servingsNote, 240) || null : null,
    ingredients,
    steps: recipe.steps.map((s, i) => ({ ...s, n: i + 1, text: sanitizeGeneratedText(s.text, 4_000) })),
    equipment: recipe.equipment.map((item) => sanitizeGeneratedText(item, 160)).filter(Boolean),
    tags: [
      ...new Set(recipe.tags.map((t) => t.toLowerCase().replace(/^#/, "").trim())),
    ].filter(Boolean),
    cuisine: recipe.cuisine ? sanitizeGeneratedText(recipe.cuisine, 120) || null : null,
    course: recipe.course ? sanitizeGeneratedText(recipe.course, 120) || null : null,
    confidence: Math.min(1, Math.max(0, recipe.confidence)),
    extractionNotes: recipe.extractionNotes
      .map((note) => sanitizeGeneratedText(note, 1_000))
      .filter(Boolean),
    // Belt-and-braces, same as canonicalItem above: the model is asked for one
    // guess per ingredient, but a missing row shouldn't be a missing lookup
    // fallback later — it becomes a zero-contribution guess instead.
    ingredientNutritionGuesses: ingredients.map((ing) => {
      const existing = recipe.ingredientNutritionGuesses.find(
        (g) => canonicalize(g.canonicalItem) === ing.canonicalItem,
      );
      return existing
        ? { ...existing, canonicalItem: ing.canonicalItem }
        : { canonicalItem: ing.canonicalItem, contribution: { ...ZERO_CONTRIBUTION } };
    }),
  };
}

function generatedRecipeIsUsable(recipe: ExtractedRecipe): boolean {
  const nonnegative = (value: number | null | undefined) =>
    value === null || value === undefined || (Number.isFinite(value) && value >= 0);
  if (!recipe.title || recipe.ingredients.length > 200 || recipe.steps.length > 200) return false;
  if (recipe.equipment.length > 100 || recipe.tags.length > 100 || recipe.extractionNotes.length > 100) return false;
  if (![recipe.servings, recipe.prepMinutes, recipe.cookMinutes, recipe.totalMinutes].every(nonnegative)) return false;
  if (recipe.ingredients.some((item) =>
    !item.item || !item.canonicalItem || !nonnegative(item.quantity) || !nonnegative(item.quantityMax))) return false;
  if (recipe.steps.some((step) =>
    !step.text || !nonnegative(step.timerSeconds) || !nonnegative(step.activeSeconds) || !nonnegative(step.sourceTimestamp))) return false;
  return recipe.ingredientNutritionGuesses.every((guess) =>
    Object.values(guess.contribution).every((value) => Number.isFinite(value) && value >= 0));
}

export async function extractRecipe(
  doc: SourceDocument,
  opts: ExtractOptions = {},
): Promise<ExtractedRecipe> {
  const client = opts.client ?? new Anthropic();
  const model = opts.model ?? EXTRACTION_MODEL;
  const sourceReference = `recipe-${doc.textKind}-v1`;
  if (doc.text.length > MAX_GENERATION_SOURCE_TEXT_CHARS) {
    throw new ExtractionError("This source is too large to extract safely. Use a shorter page or paste the recipe text directly.");
  }
  if (doc.image && doc.image.base64.length > MAX_PHOTO_BASE64_CHARS) {
    throw new ExtractionError("This photo is too large to extract safely. Use a smaller image.");
  }

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
      model,
      max_tokens: 16_000,
      // 1h TTL: imports across the whole app arrive scattered, rarely two
      // within the default 5-minute window. A longer-lived cache is what
      // actually gets hit in practice, not a hypothetical burst.
      system: [{
        type: "text",
        text: generatedContentSystem(SYSTEM, EXTRACTION_PROMPT_VERSION),
        cache_control: { type: "ephemeral", ttl: "1h" },
      }],
      thinking: { type: "adaptive" },
      output_config: {
        effort: opts.effort ?? "medium",
        format: zodOutputFormat(ExtractedRecipeSchema),
      },
      messages: [
        {
          role: "user",
          content:
            doc.textKind === "photo" && doc.image
              ? [
                  {
                    type: "image" as const,
                    source: {
                      type: "base64" as const,
                      media_type: doc.image.mediaType,
                      data: doc.image.base64,
                    },
                  },
                  { type: "text" as const, text: `${GUIDANCE.photo}\n\n${header}` },
                ]
              : `${GUIDANCE[doc.textKind]}\n\n${header}\n\n--- CONTENT ---\n${doc.text}`,
        },
      ],
    },
    { signal: opts.signal },
  );

  if (response.stop_reason === "refusal") {
    emitGenerationAudit(opts.onGenerationAudit, generationAudit(
      EXTRACTION_PROMPT_VERSION, model, sourceReference, "rejected", response,
    ));
    throw new ExtractionError(
      `The model declined to process this content (${response.stop_details?.category ?? "unspecified"}). ` +
        `If this is an ordinary recipe, try pasting the text directly.`,
    );
  }
  if (!response.parsed_output) {
    emitGenerationAudit(opts.onGenerationAudit, generationAudit(
      EXTRACTION_PROMPT_VERSION, model, sourceReference, "rejected", response,
    ));
    throw new ExtractionError(
      "The model did not return a parseable recipe. Try re-running the import.",
    );
  }

  const validated = ExtractedRecipeSchema.safeParse(normalize(response.parsed_output));
  if (!validated.success || !generatedRecipeIsUsable(validated.data)) {
    emitGenerationAudit(opts.onGenerationAudit, generationAudit(
      EXTRACTION_PROMPT_VERSION, model, sourceReference, "rejected", response,
    ));
    throw new ExtractionError("The model returned a recipe that failed validation. Try re-running the import.");
  }
  emitGenerationAudit(opts.onGenerationAudit, generationAudit(
    EXTRACTION_PROMPT_VERSION, model, sourceReference, "passed", response,
  ));
  return validated.data;
}
