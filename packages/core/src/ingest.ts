import { randomUUID } from "node:crypto";
import { extractRecipe, type ExtractOptions } from "./extract.js";
import type { ExtractionMethod, Recipe } from "./recipe.js";
import {
  ResolveError,
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

  if (!willCallModel(doc, opts)) {
    extracted = doc.prestructured!;
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

  // Nothing at all came back. That is not a recipe, and saving it puts a card
  // called "No recipe found" in someone's library — which is how a paywalled
  // Substack post ended up there. The model is usually able to say exactly why
  // (a paywall, a page that was never a recipe), and its own words beat
  // anything generic this could invent.
  if (extracted.ingredients.length === 0 && extracted.steps.length === 0) {
    const why = extracted.extractionNotes.find((note) => note.trim())?.trim();
    throw new ResolveError(
      why
        ? `No recipe could be read from that page. ${truncate(why, 300)}`
        : "No recipe could be read from that page.",
      trace,
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
  return ingestDocument(doc, opts);
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
