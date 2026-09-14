import { randomUUID } from "node:crypto";
import { extractRecipe, type ExtractOptions } from "./extract.js";
import { computeNutrition, type ComputeNutritionOptions } from "./nutrition-usda.js";
import type { ExtractionMethod, Recipe, RecipeNutrition, SourceKind } from "./recipe.js";
import { generationAuditTrace } from "./generated-content.js";
import {
  EmptyExtractionError,
  methodForTextKind,
  resolveSource,
  textSource,
  type ResolveOptions,
  type SourceDocument,
} from "./sources/index.js";

/** The social sources where the caption-substantive check can hide a real transcript behind it — YouTube always tries a transcript regardless, so retrying it would just repeat the same failed attempt. */
const RETRIABLE_CAPTION_KINDS = new Set<SourceKind>(["tiktok", "instagram", "facebook"]);

export interface IngestOptions extends ResolveOptions, ExtractOptions {
  /**
   * Ignore a page's machine-readable recipe and run the model anyway.
   * Costs a call; worth it when the site's own card is thin or wrong.
   */
  forceModel?: boolean;
  /** Passed straight through to computeNutrition — the injection seam tests use to stay offline. */
  nutrition?: ComputeNutritionOptions;
}

export interface IngestResult {
  recipe: Recipe;
  /** What the pipeline actually did, in order. Surfaced in the import UI. */
  trace: string[];
  /** True when we produced a recipe without spending a model call. */
  freeExtraction: boolean;
}

/**
 * Attach video timestamps to steps the model didn't tag, by finding the cue
 * that best matches the step's wording. Cheap safety net for the "jump to this
 * moment in the video" affordance.
 */
function backfillTimestamps(recipe: Recipe, doc: SourceDocument): Recipe {
  if (!doc.cues?.length) return recipe;
  const cues = doc.cues;

  const keywords = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z ]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 4),
    );

  let floor = 0;
  const steps = recipe.steps.map((step) => {
    if (step.sourceTimestamp !== null) {
      floor = Math.max(floor, step.sourceTimestamp);
      return step;
    }
    const want = keywords(step.text);
    if (want.size === 0) return step;

    let best: { start: number; score: number } | null = null;
    for (const cue of cues) {
      if (cue.start < floor) continue; // steps only move forward through the video
      const have = keywords(cue.text);
      let score = 0;
      for (const w of want) if (have.has(w)) score++;
      if (score > (best?.score ?? 0)) best = { start: cue.start, score };
    }
    if (!best || best.score < 2) return step;
    floor = best.start;
    return { ...step, sourceTimestamp: best.start };
  });

  return { ...recipe, steps };
}

/**
 * Extract from an already-resolved document. Exposed so callers that want to
 * report progress (resolve... then extract...) can drive the two halves
 * separately instead of waiting on one opaque call.
 */
export async function ingestDocument(
  doc: SourceDocument,
  opts: IngestOptions = {},
): Promise<IngestResult> {
  const trace = [...doc.trace];
  let method: ExtractionMethod;
  let extracted;
  let nutrition: RecipeNutrition | null;

  if (!willCallModel(doc, opts)) {
    extracted = doc.prestructured!;
    method = doc.prestructuredMethod ?? "schema-org";
    trace.push(
      method === "schema-org"
        ? "extraction: used the page's own schema.org recipe (no model call)"
        : "extraction: read a structured export from another app (no model call)",
    );
    // Nothing here calls a model, so there's no free per-ingredient fallback
    // guess to lean on. Only the page's own published figures are trustworthy
    // enough to attach automatically; anything else waits for someone to ask
    // for it explicitly, rather than silently under-reporting whatever
    // ingredient a database lookup alone can't identify.
    nutrition = doc.prestructuredNutrition ?? null;
    trace.push(
      nutrition
        ? "nutrition: read from the page's own published figures"
        : "nutrition: not published on this page — available on request",
    );
  } else {
    extracted = await extractRecipe(doc, {
      ...opts,
      onGenerationAudit: (audit) => {
        trace.push(generationAuditTrace(audit));
        opts.onGenerationAudit?.(audit);
      },
    });
    method = methodForTextKind(doc.textKind);
    trace.push(`extraction: ${method} via ${opts.model ?? "claude-opus-5"}`);
    trace.push(
      `extraction: ${extracted.ingredients.length} ingredients, ${extracted.steps.length} steps, ` +
        `confidence ${extracted.confidence.toFixed(2)}`,
    );
    // Rides along with the extraction that already happened: USDA first per
    // ingredient, the model's own guesses above as the fallback. No second
    // model call.
    nutrition = await computeNutrition(
      extracted.ingredients,
      extracted.ingredientNutritionGuesses,
      extracted.servings,
      opts.nutrition,
    );
    const usdaHits = nutrition.perIngredient.filter((i) => i.source === "usda").length;
    trace.push(
      `nutrition: ${usdaHits}/${nutrition.perIngredient.length} ingredients matched to a food database`,
    );
  }

  // Nothing at all came back. That is not a recipe, and saving it puts a card
  // called "No recipe found" in someone's library — which is how a paywalled
  // Substack post ended up there. The model is usually able to say exactly why
  // (a paywall, a page that was never a recipe), and its own words beat
  // anything generic this could invent.
  if (extracted.ingredients.length === 0 && extracted.steps.length === 0) {
    const why = extracted.extractionNotes.find((note) => note.trim())?.trim();
    throw new EmptyExtractionError(
      why
        ? `No recipe could be read from that page. ${truncate(why, 300)}`
        : "No recipe could be read from that page.",
      trace,
    );
  }

  // The model's raw per-ingredient guesses did their one job — feeding
  // computeNutrition above — and don't need to live on past that. What's
  // worth keeping is the resolved result in `nutrition`, not the intermediate
  // guesses that produced it.
  const { ingredientNutritionGuesses: _guesses, ...extractedWithoutGuesses } = extracted;

  const recipe: Recipe = backfillTimestamps(
    {
      ...extractedWithoutGuesses,
      ingredientNutritionGuesses: [],
      id: randomUUID(),
      imageUrl: doc.imageUrl,
      photos: [],
      source: {
        kind: doc.kind,
        url: doc.url,
        author: doc.author,
        siteName: doc.siteName,
        extractionMethod: method,
      },
      nutrition,
    },
    doc,
  );

  return { recipe, trace, freeExtraction: method === "schema-org" || method === "file-import" };
}

/**
 * Will turning this document into a recipe cost a model call?
 *
 * The one place that decides, so the importer and whatever meters it can never
 * disagree. A caller can resolve a source, ask this, and refuse before paying
 * for an extraction rather than after.
 */
export function willCallModel(
  doc: Pick<SourceDocument, "prestructured">,
  opts: Pick<IngestOptions, "forceModel"> = {},
): boolean {
  return !(doc.prestructured && !opts.forceModel);
}

/** Paste a link from anywhere, get a recipe card. The one function the app is built around. */
export async function ingestUrl(url: string, opts: IngestOptions = {}): Promise<IngestResult> {
  const doc = await resolveSource(url, opts);
  try {
    return await ingestDocument(doc, opts);
  } catch (err) {
    // The caption looked plausible enough to spend a model call on and still
    // came back empty. The video's own audio is the one thing left to try —
    // worth the second call only when there's a real chance it changes
    // anything: a social caption (not already a transcript, and not
    // YouTube, which already tries a transcript unconditionally so retrying
    // it would just repeat the exact same failed attempt).
    if (
      err instanceof EmptyExtractionError &&
      RETRIABLE_CAPTION_KINDS.has(doc.kind) &&
      doc.textKind === "caption" &&
      opts.allowTranscription !== false
    ) {
      const retryDoc = await resolveSource(url, { ...opts, forceTranscript: true });
      if (retryDoc.textKind === "transcript") {
        retryDoc.trace = [
          ...doc.trace,
          "extraction: the caption looked like a recipe but came back empty — retrying from the video's own audio",
          ...retryDoc.trace,
        ];
        return ingestDocument(retryDoc, opts);
      }
    }
    throw err;
  }
}

/** Same pipeline for text the user typed or pasted (screenshot OCR, a family recipe, a DM). */
export async function ingestText(
  text: string,
  opts: IngestOptions & { title?: string } = {},
): Promise<IngestResult> {
  return ingestDocument(textSource(text, opts.title), opts);
}

const truncate = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
