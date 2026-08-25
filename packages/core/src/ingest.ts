import { randomUUID } from "node:crypto";
import { extractRecipe, type ExtractOptions } from "./extract.js";
import type { ExtractionMethod, Recipe } from "./recipe.js";
import {
  methodForTextKind,
  resolveSource,
  textSource,
  type ResolveOptions,
  type SourceDocument,
} from "./sources/index.js";

export interface IngestOptions extends ResolveOptions, ExtractOptions {
  /**
   * Ignore a page's machine-readable recipe and run the model anyway.
   * Costs a call; worth it when the site's own card is thin or wrong.
   */
  forceModel?: boolean;
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

  if (doc.prestructured && !opts.forceModel) {
    extracted = doc.prestructured;
    method = "schema-org";
    trace.push("extraction: used the page's own schema.org recipe (no model call)");
  } else {
    extracted = await extractRecipe(doc, opts);
    method = methodForTextKind(doc.textKind);
    trace.push(`extraction: ${method} via ${opts.model ?? "claude-opus-5"}`);
    trace.push(
      `extraction: ${extracted.ingredients.length} ingredients, ${extracted.steps.length} steps, ` +
        `confidence ${extracted.confidence.toFixed(2)}`,
    );
  }

  const recipe: Recipe = backfillTimestamps(
    {
      ...extracted,
      id: randomUUID(),
      imageUrl: doc.imageUrl,
      source: {
        kind: doc.kind,
        url: doc.url,
        author: doc.author,
        siteName: doc.siteName,
        extractionMethod: method,
      },
    },
    doc,
  );

  return { recipe, trace, freeExtraction: method === "schema-org" };
}

/** Paste a link from anywhere, get a recipe card. The one function the app is built around. */
export async function ingestUrl(url: string, opts: IngestOptions = {}): Promise<IngestResult> {
  const doc = await resolveSource(url, opts);
  return ingestDocument(doc, opts);
}

/** Same pipeline for text the user typed or pasted (screenshot OCR, a family recipe, a DM). */
export async function ingestText(
  text: string,
  opts: IngestOptions & { title?: string } = {},
): Promise<IngestResult> {
  return ingestDocument(textSource(text, opts.title), opts);
}
