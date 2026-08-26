import type { SourceKind } from "../recipe.js";
import { detectSourceKind } from "../source-kind.js";
import { extractArticleText } from "./article.js";
import { fetchText } from "./fetch.js";
import { extractJsonLdRecipe } from "./jsonld.js";
import { fetchSocial } from "./social.js";
import {
  asrConfigFromEnv,
  subtitlesViaYtDlp,
  transcribeUrl,
  ytDlpAvailable,
} from "./transcribe.js";
import { ResolveError, type ResolveOptions, type SourceDocument } from "./types.js";
import { assertPublicHttpUrl } from "./url-guard.js";
import { cuesToTranscript, fetchYoutube } from "./youtube.js";

export * from "./types.js";
export { assertPublicHttpUrl, UnsafeUrlError } from "./url-guard.js";
export { extractArticleText } from "./article.js";
export { extractJsonLdRecipe, isoDurationToMinutes } from "./jsonld.js";
export { fetchSocial } from "./social.js";
export { detectSourceKind, socialKind, youtubeVideoId } from "../source-kind.js";
export {
  asrConfigFromEnv,
  subtitlesViaYtDlp,
  transcribeUrl,
  ytDlpAvailable,
} from "./transcribe.js";
export { coalesceCues, cuesToTranscript, fetchYoutube } from "./youtube.js";

/** A caption is only worth extracting from if it's long enough to plausibly hold a recipe. */
const captionIsSubstantive = (c: string | null): c is string =>
  !!c && c.replace(/\s+/g, " ").trim().length >= 120;

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
  }

  // The caption track is the prize, and yt-dlp can usually fetch the one
  // YouTube won't hand a server directly. Free and quick, so it goes ahead of
  // ASR — but it isn't worth the wait for a post whose caption is already the
  // whole recipe.
  const wantsTranscript =
    !transcript &&
    opts.allowTranscription !== false &&
    (kind === "youtube" || !captionIsSubstantive(caption));

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
  if (!transcript && !captionIsSubstantive(caption) && opts.allowTranscription !== false) {
    const asr = asrConfigFromEnv();
    if (!asr) {
      trace.push("asr: skipped (no DEEPGRAM_API_KEY or GROQ_API_KEY)");
    } else if (!(await ytDlpAvailable())) {
      trace.push("asr: skipped (yt-dlp not on PATH)");
    } else {
      trace.push(`asr: transcribing with ${asr.provider}`);
      const asrCues = await transcribeUrl(url, asr);
      if (asrCues.length) {
        cues = asrCues;
        transcript = cuesToTranscript(asrCues);
        trace.push(`asr: ${asrCues.length} segments`);
      }
    }
  }

  if (!transcript && !captionIsSubstantive(caption)) {
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
    ? captionIsSubstantive(caption)
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
  return kind === "web"
    ? resolveWeb(url, opts, trace)
    : resolveVideo(url, kind, opts, trace);
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
