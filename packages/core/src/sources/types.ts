import type {
  ExtractedRecipe,
  ExtractionMethod,
  PhotoMediaType,
  RecipeNutrition,
  SourceKind,
} from "../recipe.js";
import type { GenerationAuditSink } from "../generated-content.js";

/**
 * Whatever we managed to pull out of a URL before any model is involved.
 * A resolver's job is to fill in as much of this as it can, as cheaply as it can.
 */
export interface SourceDocument {
  kind: SourceKind;
  url: string | null;
  title: string | null;
  author: string | null;
  siteName: string | null;
  imageUrl: string | null;
  /** Prose the extractor will read: article body, transcript, or caption. Empty for a photo source. */
  text: string;
  /** Which flavour of text `text` holds — picks the extraction prompt. */
  textKind: "article" | "transcript" | "caption" | "raw" | "photo";
  /** A photographed page — a recipe card, a cookbook spread, a handwritten note. */
  image?: {
    base64: string;
    mediaType: PhotoMediaType;
  };
  /** Set when the page already published a machine-readable recipe; skips the model entirely. */
  prestructured?: ExtractedRecipe;
  /**
   * The extraction method to record when `prestructured` is used. Defaults to
   * "schema-org" (a page's own JSON-LD) when unset — a structured import from
   * another app (Paprika, ...) sets this to "file-import" instead so the trust
   * badge doesn't claim to have read a live web page it never saw. Narrowed to
   * the two methods that actually mean "no model call happened" — the only
   * two valid here — so a future prestructured source can't accidentally be
   * tagged with a model-based method like "photo-llm" by copy-paste.
   */
  prestructuredMethod?: Extract<ExtractionMethod, "schema-org" | "file-import">;
  /** The page's own nutrition figures, when its schema.org data included any. */
  prestructuredNutrition?: RecipeNutrition | null;
  /** Transcript cue points, used to attach `sourceTimestamp` to steps. */
  cues?: TranscriptCue[];
  /** Human-readable trail of what each resolver tried. Shown when things go wrong. */
  trace: string[];
}

export interface TranscriptCue {
  /** Seconds from the start of the media. */
  start: number;
  text: string;
}

export interface ResolveOptions {
  /** Allow paid/slow paths: downloading media and running ASR. Default true. */
  allowTranscription?: boolean;
  /**
   * Skip the "does the caption already look like a recipe" check and go
   * straight for a transcript. Set by ingestUrl's own retry when a caption
   * that looked plausible enough to try turned out empty — at that point the
   * question isn't "is this worth the wait" anymore, it's "is there anything
   * else to try at all."
   */
  forceTranscript?: boolean;
  signal?: AbortSignal;
  onGenerationAudit?: GenerationAuditSink;
}

export class ResolveError extends Error {
  constructor(
    message: string,
    readonly trace: string[] = [],
  ) {
    super(message);
    this.name = "ResolveError";
  }
}

/**
 * ingestDocument ran to completion — reading structured data or calling the
 * model, whichever this document's own prestructured/textKind called for —
 * and got zero ingredients and zero steps back. Distinct from every other
 * ResolveError, which means resolution itself never got that far.
 * ingestUrl catches this one specifically to decide whether a transcript is
 * worth trying next; every other failure mode has nothing left to fall back to.
 */
export class EmptyExtractionError extends ResolveError {}

export const methodForTextKind = (
  k: SourceDocument["textKind"],
): ExtractionMethod =>
  k === "transcript"
    ? "transcript-llm"
    : k === "caption"
      ? "caption-llm"
      : k === "photo"
        ? "photo-llm"
        : "article-llm";
