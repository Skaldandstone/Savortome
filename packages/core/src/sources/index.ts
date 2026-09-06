import type { PhotoMediaType, SourceKind } from "../recipe.js";
import type { PaprikaImportItem } from "../importers/paprika.js";
import { detectSourceKind } from "../source-kind.js";
import { extractArticleText } from "./article.js";
import { fetchText } from "./fetch.js";
import { extractJsonLdRecipe } from "./jsonld.js";
import { fetchSocial } from "./social.js";
import {
  asrConfigFromEnv,
  metadataViaYtDlp,
  subtitlesViaYtDlp,
  transcribeUrl,
  ytDlpAvailable,
} from "./transcribe.js";
import { ResolveError, type ResolveOptions, type SourceDocument } from "./types.js";
import { assertPublicHttpUrl, UnsafeUrlError } from "./url-guard.js";
import { cuesToTranscript, fetchYoutube } from "./youtube.js";

export * from "./types.js";
export { assertPublicHttpUrl, UnsafeUrlError } from "./url-guard.js";
export { extractArticleText } from "./article.js";
export {
  parsePaprikaExport,
  type PaprikaImportItem,
  type PaprikaImportResult,
} from "../importers/paprika.js";
export { extractJsonLdRecipe, isoDurationToMinutes } from "./jsonld.js";
export { fetchSocial } from "./social.js";
export { detectSourceKind, socialKind, youtubeVideoId } from "../source-kind.js";
export {
  asrConfigFromEnv,
  metadataViaYtDlp,
  subtitlesViaYtDlp,
  transcribeUrl,
  ytDlpAvailable,
} from "./transcribe.js";
export { coalesceCues, cuesToTranscript, fetchYoutube } from "./youtube.js";

/**
 * Whether a caption looks like it actually contains a recipe — not just
 * whether it's long enough to. A caption clears any length threshold with
 * nothing but a title and a wall of hashtags; a real ingredient list or
 * numbered steps is what actually predicts an extraction has something to
 * work with. Biased toward false negatives on purpose: a caption wrongly
 * judged "not a recipe" just means a transcript gets tried too, which costs
 * a little time; a caption wrongly judged substantive skips straight to a
 * model call that was always going to come back empty.
 */
const RECIPE_UNIT_PATTERN =
  /\b\d+(?:[.,]\d+)?\s*(?:cups?|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|g|grams?|kg|ml|l|liters?|litres?|lbs?|pounds?|cloves?|slices?|pinch(?:es)?|dash(?:es)?|cans?|packets?|sticks?)\b/gi;
const STEP_PATTERN = /(?:^|\n)\s*(?:\d+[.):]|step\s+\d+\b)/im;
const RECIPE_LABEL_PATTERN = /\b(?:ingredients?|directions?|instructions?)\s*:/i;

export function looksLikeRecipe(c: string | null): c is string {
  if (!c) return false;
  const t = c.trim();
  if (!t) return false;
  const unitMatches = t.match(RECIPE_UNIT_PATTERN)?.length ?? 0;
  return unitMatches >= 2 || STEP_PATTERN.test(t) || RECIPE_LABEL_PATTERN.test(t);
}

async function resolveVideo(
  url: string,
  kind: SourceKind,
  opts: ResolveOptions,
  trace: string[],
): Promise<SourceDocument> {
  let title: string | null = null;
  let author: string | null = null;
  let imageUrl: string | null = null;
  let caption: string | null = null;
  let transcript: string | null = null;
  let cues: SourceDocument["cues"];

  if (kind === "youtube") {
    const yt = await fetchYoutube(url);
    ({ title, author } = yt);
    imageUrl = yt.thumbnail;
    caption = yt.description;
    if (yt.cues?.length) {
      cues = yt.cues;
      transcript = cuesToTranscript(yt.cues);
      trace.push(`youtube: ${yt.cues.length} caption cues`);
    } else if (yt.captionStatus === "none") {
      trace.push("youtube: the video publishes no captions");
    } else {
      // Worth spelling out. This looks identical to "no captions" from the
      // outside and sends you looking in the wrong place entirely. What
      // happens next is yt-dlp's line to report, not this one's.
      trace.push("youtube: captions exist but YouTube won't serve them to a server directly");
    }
  } else {
    const s = await fetchSocial(url, kind);
    title = s.title;
    author = s.author;
    imageUrl = s.imageUrl;
    caption = s.caption;
    trace.push(`${kind}: caption ${caption ? `${caption.length} chars` : "unavailable"}`);

    // Instagram and Facebook serve a login wall to anything that looks like a
    // scraper, so the Open Graph tags come back empty — and for a Reel the
    // caption usually is the recipe. yt-dlp still gets it.
    if (!caption && opts.allowTranscription !== false && (await ytDlpAvailable())) {
      const meta = await metadataViaYtDlp(url);
      if (meta?.description) {
        caption = meta.description;
        title = title ?? meta.title;
        author = author ?? meta.uploader;
        imageUrl = imageUrl ?? meta.thumbnail;
        trace.push(`yt-dlp: caption ${caption.length} chars`);
      } else {
        trace.push("yt-dlp: no caption either");
      }
    }
  }

  // The caption track is the prize, and yt-dlp can usually fetch the one
  // YouTube won't hand a server directly. Free and quick, so it goes ahead of
  // ASR — but it isn't worth the wait for a post whose caption is already the
  // whole recipe. forceTranscript overrides that: set only by ingestUrl's own
  // retry, after a caption that looked plausible enough to try came back empty.
  const wantsTranscript =
    !transcript &&
    opts.allowTranscription !== false &&
    (kind === "youtube" || opts.forceTranscript || !looksLikeRecipe(caption));

  if (wantsTranscript && (await ytDlpAvailable())) {
    const subs = await subtitlesViaYtDlp(url);
    if (subs.length) {
      cues = subs;
      transcript = cuesToTranscript(subs);
      trace.push(`yt-dlp: ${subs.length} caption cues`);
    } else {
      trace.push("yt-dlp: no subtitles published");
    }
  }

  // Still nothing spoken and no usable post text — download the audio and run ASR.
  if (
    !transcript &&
    (opts.forceTranscript || !looksLikeRecipe(caption)) &&
    opts.allowTranscription !== false
  ) {
    const asr = asrConfigFromEnv();
    if (!asr) {
      trace.push("asr: skipped (no DEEPGRAM_API_KEY or GROQ_API_KEY)");
    } else if (!(await ytDlpAvailable())) {
      trace.push("asr: skipped (yt-dlp not on PATH)");
    } else {
      trace.push(`asr: transcribing with ${asr.provider}`);
      // Every other fallback in this function degrades gracefully on
      // failure (subtitlesViaYtDlp and metadataViaYtDlp already catch their
      // own errors) — this one didn't, so a transient Deepgram/Groq error,
      // an age-restricted or deleted video, or a stream past the length cap
      // would crash the whole import instead of falling back to whatever
      // caption is already in hand.
      try {
        const asrCues = await transcribeUrl(url, asr);
        if (asrCues.length) {
          cues = asrCues;
          transcript = cuesToTranscript(asrCues);
          trace.push(`asr: ${asrCues.length} segments`);
        } else {
          trace.push("asr: no speech recognized");
        }
      } catch (err) {
        trace.push(`asr: failed (${err instanceof Error ? err.message : "unknown error"})`);
      }
    }
  }

  if (!transcript && !looksLikeRecipe(caption)) {
    throw new ResolveError(
      `Could not get spoken text or a usable caption from this ${kind} link. ` +
        `Install yt-dlp to read caption tracks, add DEEPGRAM_API_KEY (or GROQ_API_KEY) ` +
        `to transcribe audio when there are none, or paste the recipe text directly.`,
      trace,
    );
  }

  // Captions frequently carry exact amounts the narration glosses over ("a splash of oil"),
  // so when we have both we hand the model both and let it reconcile them.
  const text = transcript
    ? looksLikeRecipe(caption)
      ? `${transcript}\n\n--- POST CAPTION / DESCRIPTION ---\n${caption}`
      : transcript
    : (caption as string);

  return {
    kind,
    url,
    title,
    author,
    siteName: kind,
    imageUrl,
    text,
    textKind: transcript ? "transcript" : "caption",
    cues,
    trace,
  };
}

async function resolveWeb(
  url: string,
  opts: ResolveOptions,
  trace: string[],
): Promise<SourceDocument> {
  const html = await fetchText(url, { signal: opts.signal });
  const article = extractArticleText(html);
  const jsonld = extractJsonLdRecipe(html);

  if (jsonld) {
    trace.push(
      `schema.org: found Recipe (${jsonld.recipe.ingredients.length} ingredients, ` +
        `${Math.round(jsonld.parseCoverage * 100)}% of lines parsed)`,
    );
  } else {
    trace.push("schema.org: no machine-readable Recipe on the page");
  }

  if (!article.text.trim() && !jsonld) {
    throw new ResolveError(`No readable content found at ${url}`, trace);
  }

  return {
    kind: "web",
    url,
    title: jsonld?.recipe.title ?? article.title,
    author: jsonld?.author ?? article.author,
    siteName: article.siteName ?? new URL(url).hostname.replace(/^www\./, ""),
    imageUrl: jsonld?.imageUrl ?? article.imageUrl,
    text: article.text,
    textKind: "article",
    // Only trust the deterministic parse when it actually split most lines;
    // otherwise the model gets a shot at the same page.
    prestructured: jsonld && jsonld.parseCoverage >= 0.6 ? jsonld.recipe : undefined,
    // Published nutrition travels with the recipe it describes — a page whose
    // ingredient parse wasn't trusted enough to skip the model shouldn't have
    // its nutrition figures trusted either, since they were read off the same
    // structured block.
    prestructuredNutrition:
      jsonld && jsonld.parseCoverage >= 0.6 ? jsonld.nutrition : undefined,
    trace,
  };
}

/** Turn any supported URL into text (and, where we can, a ready-made recipe). */
export async function resolveSource(
  url: string,
  opts: ResolveOptions = {},
): Promise<SourceDocument> {
  const trace: string[] = [];
  // Reject private/loopback targets before any request leaves the server.
  await assertPublicHttpUrl(url);
  const kind = detectSourceKind(url);
  trace.push(`detected source: ${kind}`);
  try {
    return await (kind === "web"
      ? resolveWeb(url, opts, trace)
      : resolveVideo(url, kind, opts, trace));
  } catch (err) {
    // fetchText/fetchJson throw a plain Error for a non-2xx response or a
    // network failure — a dead link, a deleted post, a site that's down.
    // None of that is a bug in this app, so it deserves the same 4xx
    // treatment every other resolution failure gets (a clear message,
    // "couldn't read this" rather than "something went wrong on our end"),
    // not the generic 500 an unwrapped Error falls through to. Every
    // resolver's own deliberate failures already throw ResolveError or
    // UnsafeUrlError directly, so those pass through unchanged here.
    if (err instanceof ResolveError || err instanceof UnsafeUrlError) throw err;
    throw new ResolveError(
      `Couldn't reach that link: ${err instanceof Error ? err.message : "unknown error"}.`,
      trace,
    );
  }
}

/** Wrap pasted text so it can go through the same extractor as a scraped page. */
export function textSource(text: string, title?: string): SourceDocument {
  return {
    kind: "text",
    url: null,
    title: title ?? null,
    author: null,
    siteName: null,
    imageUrl: null,
    text,
    textKind: "raw",
    trace: ["pasted text"],
  };
}

/**
 * Wrap a photographed page — a recipe card, a cookbook spread, a handwritten
 * note — so it goes through the same extractor, reading the image directly
 * rather than needing OCR run first.
 */
export function photoSource(
  base64: string,
  mediaType: PhotoMediaType,
  title?: string,
): SourceDocument {
  return {
    kind: "photo",
    url: null,
    title: title ?? null,
    author: null,
    siteName: null,
    imageUrl: null,
    text: "",
    textKind: "photo",
    image: { base64, mediaType },
    trace: ["photographed page"],
  };
}

/**
 * Wrap one recipe parsed out of another app's export so it goes through the
 * same `ingestDocument` pipeline as everything else, skipping the model the
 * same way a page's own schema.org data does.
 */
export function paprikaSource(item: PaprikaImportItem): SourceDocument {
  return {
    kind: "paprika",
    url: item.sourceUrl,
    title: item.recipe.title,
    author: item.author,
    siteName: "Paprika",
    imageUrl: item.imageUrl,
    text: "",
    textKind: "raw",
    prestructured: item.recipe,
    prestructuredMethod: "file-import",
    trace: ["paprika: read from the account's exported .paprikarecipes file (no model call)"],
  };
}
