import type {
  ExtractedRecipe,
  ExtractionMethod,
  PhotoMediaType,
  RecipeNutrition,
  SourceKind,
} from "../recipe.js";

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
   * badge doesn't claim to have read a live web page it never saw.
   */
  prestructuredMethod?: ExtractionMethod;
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
  signal?: AbortSignal;
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
