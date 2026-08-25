import type { ExtractedRecipe, ExtractionMethod, SourceKind } from "../recipe.js";

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
  /** Prose the extractor will read: article body, transcript, or caption. */
  text: string;
  /** Which flavour of text `text` holds — picks the extraction prompt. */
  textKind: "article" | "transcript" | "caption" | "raw";
  /** Set when the page already published a machine-readable recipe; skips the model entirely. */
  prestructured?: ExtractedRecipe;
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
      : "article-llm";
