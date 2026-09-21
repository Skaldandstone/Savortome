import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TranscriptCue } from "./types.js";
import { parseJson3Cues } from "./youtube.js";
import {
  emitGenerationAudit,
  providerGenerationAudit,
  sanitizeGeneratedText,
  type GenerationAuditSink,
} from "../generated-content.js";

/**
 * Last-resort path for videos with no captions and no useful caption text:
 * pull the audio with yt-dlp, run it through an ASR provider, and hand the
 * resulting cues to the same extractor the caption path uses.
 *
 * Requires `yt-dlp` (and ffmpeg) on PATH plus an ASR key. Both are optional —
 * without them the pipeline degrades to caption/description extraction instead
 * of failing, so a deploy with neither still works for most links.
 */

/**
 * Where the binaries are.
 *
 * PATH is the normal answer, but it can't be relied on: winget installs
 * yt-dlp without adding it to PATH at all, and hosts vary. Naming the binary
 * explicitly costs one env var and removes a whole class of "it works on my
 * machine".
 */
export const ytDlpBin = (env: NodeJS.ProcessEnv = process.env): string =>
  env.YT_DLP_PATH || "yt-dlp";

export const ffmpegBin = (env: NodeJS.ProcessEnv = process.env): string | null =>
  env.FFMPEG_PATH || null;

export type AsrProvider = "deepgram" | "groq";

export interface TranscribeConfig {
  provider: AsrProvider;
  apiKey: string;
  /** Cap on media length; long streams are expensive and rarely recipes. */
  maxDurationSeconds?: number;
  onGenerationAudit?: GenerationAuditSink;
}

export const ASR_ADAPTER_PROMPT_VERSION = "savortome-asr-adapter-v1";

/**
 * Long streams are expensive to run through ASR and are rarely recipes — a
 * podcast, a full movie, a livestream VOD. 20 minutes covers any real recipe
 * video with room to spare. Overridable since "rarely" isn't "never".
 */
const DEFAULT_MAX_TRANSCRIBE_SECONDS = 20 * 60;
export const MAX_TRANSCRIPT_CUES = 500;
export const MAX_TRANSCRIPT_CHARS = 120_000;

/** Bound and clean provider-produced text before it becomes prompt input. */
export function normalizeTranscriptCues(cues: readonly TranscriptCue[]): TranscriptCue[] {
  const normalized: TranscriptCue[] = [];
  let totalChars = 0;
  for (const cue of cues) {
    if (normalized.length >= MAX_TRANSCRIPT_CUES) break;
    if (!Number.isFinite(cue.start) || cue.start < 0 || typeof cue.text !== "string") continue;
    const remaining = MAX_TRANSCRIPT_CHARS - totalChars;
    if (remaining <= 0) break;
    const text = sanitizeGeneratedText(cue.text, Math.min(1_000, remaining));
    if (!text) continue;
    normalized.push({ start: Math.round(cue.start), text });
    totalChars += text.length;
  }
  return normalized;
}

export function asrConfigFromEnv(env: NodeJS.ProcessEnv = process.env): TranscribeConfig | null {
  const maxDurationSeconds = env.MAX_TRANSCRIBE_SECONDS
    ? Number(env.MAX_TRANSCRIBE_SECONDS)
    : DEFAULT_MAX_TRANSCRIBE_SECONDS;
  if (env.DEEPGRAM_API_KEY) return { provider: "deepgram", apiKey: env.DEEPGRAM_API_KEY, maxDurationSeconds };
  if (env.GROQ_API_KEY) return { provider: "groq", apiKey: env.GROQ_API_KEY, maxDurationSeconds };
  return null;
}

function run(cmd: string, args: string[], timeoutMs = 180_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { windowsHide: true });
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${cmd} timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => (err += d.toString()));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(
        (e as NodeJS.ErrnoException).code === "ENOENT"
          ? new Error(`${cmd} is not installed or not on PATH`)
          : e,
      );
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}: ${err.slice(-500)}`));
    });
  });
}

export async function ytDlpAvailable(): Promise<boolean> {
  try {
    await run(ytDlpBin(), ["--version"], 15_000);
    return true;
  } catch {
    return false;
  }
}

export interface VideoMetadata {
  title: string | null;
  description: string | null;
  uploader: string | null;
  thumbnail: string | null;
}

/**
 * Post metadata, fetched through yt-dlp.
 *
 * Instagram and Facebook serve a login wall to anything that looks like a
 * scraper, so the Open Graph tags the social resolver reads come back empty —
 * and for a Reel the caption usually *is* the recipe. yt-dlp still gets it.
 *
 * One extra process per import, and only when the page itself gave us nothing.
 */
export async function metadataViaYtDlp(url: string): Promise<VideoMetadata | null> {
  try {
    const raw = await run(
      ytDlpBin(),
      ["--skip-download", "--dump-json", "--no-warnings", "--no-playlist", url],
      60_000,
    );

    const data = JSON.parse(raw) as Record<string, unknown>;
    return {
      title: (data.title as string | undefined) ?? null,
      description: (data.description as string | undefined) ?? null,
      // `uploader` is the display name; `channel` is the handle. The name reads
      // better as an attribution line.
      uploader:
        (data.uploader as string | undefined) ?? (data.channel as string | undefined) ?? null,
      thumbnail: (data.thumbnail as string | undefined) ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Captions, fetched through yt-dlp.
 *
 * YouTube's own /api/timedtext answers a plain server request with an empty
 * 200, but the tracks are still there and yt-dlp knows how to ask. Always try
 * this before transcribing audio: it's free, it takes a second or two rather
 * than minutes, and a human-written track beats any ASR pass — the automatic
 * one on our test video renders "Jacques Pépin" as "zck Pepa".
 */
export async function subtitlesViaYtDlp(url: string): Promise<TranscriptCue[]> {
  const dir = await mkdtemp(join(tmpdir(), "seconds-subs-"));

  try {
    await run(
      ytDlpBin(),
      [
        "--skip-download",
        "--write-subs",
        "--write-auto-subs",
        "--sub-langs", "en.*",
        "--sub-format", "json3",
        "--no-playlist",
        "-o", join(dir, "%(id)s.%(ext)s"),
        url,
      ],
      90_000,
    );

    let best: TranscriptCue[] = [];
    let bestScore = -1;

    for (const file of await readdir(dir)) {
      if (!file.endsWith(".json3")) continue;
      const cues = parseJson3Cues(await readFile(join(dir, file), "utf8"));
      if (!cues.length) continue;

      // Sentence punctuation is what separates a human-written track from an
      // automatic one, and the difference in extraction quality is large.
      const score = /[.!?]/.test(cues.map((c) => c.text).join(" ")) ? 2 : 1;
      if (score > bestScore) {
        bestScore = score;
        best = cues;
      }
    }

    return best;
  } catch {
    // No subtitles published, or yt-dlp couldn't reach them. The caller falls
    // through to ASR.
    return [];
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * The video's length, in seconds, or null when yt-dlp can't say (an
 * unsupported site, a transient failure) — that's not reason enough to
 * refuse a transcript outright, so the caller treats null as "no cap
 * applies" rather than as a hard stop.
 */
async function videoDurationSeconds(url: string): Promise<number | null> {
  try {
    const raw = await run(
      ytDlpBin(),
      ["--skip-download", "--print", "duration", "--no-warnings", "--no-playlist", url],
      30_000,
    );
    const n = Number(raw.trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/** Download the audio track only — far smaller and faster than the full video. */
async function downloadAudio(url: string): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), "seconds-"));
  const path = join(dir, "audio.m4a");
  const ffmpeg = ffmpegBin();
  await run(ytDlpBin(), [
    "-f", "bestaudio[ext=m4a]/bestaudio",
    "-x", "--audio-format", "m4a",
    // Audio extraction is the one step that needs ffmpeg; subtitles don't.
    ...(ffmpeg ? ["--ffmpeg-location", ffmpeg] : []),
    "--no-playlist",
    "--max-filesize", "80M",
    "-o", path,
    url,
  ]);
  return { path, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

interface AsrResult {
  cues: TranscriptCue[];
  responseId: string | null;
  model: string;
}

async function deepgram(audio: Buffer, apiKey: string): Promise<AsrResult> {
  const res = await fetch(
    "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&paragraphs=true",
    {
      method: "POST",
      headers: { authorization: `Token ${apiKey}`, "content-type": "audio/m4a" },
      body: new Uint8Array(audio),
    },
  );
  if (!res.ok) throw new Error(`Deepgram ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as {
    metadata?: { request_id?: string; model_info?: Record<string, unknown> };
    results?: {
      channels?: {
        alternatives?: {
          paragraphs?: { paragraphs?: { sentences?: { start: number; text: string }[] }[] };
          transcript?: string;
        }[];
      }[];
    };
  };
  const alt = json.results?.channels?.[0]?.alternatives?.[0];
  const sentences = alt?.paragraphs?.paragraphs?.flatMap((p) => p.sentences ?? []) ?? [];
  if (sentences.length) {
    return {
      cues: sentences.map((s) => ({ start: Math.round(s.start), text: s.text })),
      responseId: json.metadata?.request_id ?? null,
      model: "nova-3",
    };
  }
  return {
    cues: alt?.transcript ? [{ start: 0, text: alt.transcript }] : [],
    responseId: json.metadata?.request_id ?? null,
    model: "nova-3",
  };
}

async function groqWhisper(audio: Buffer, apiKey: string): Promise<AsrResult> {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(audio)], { type: "audio/m4a" }), "audio.m4a");
  form.append("model", "whisper-large-v3");
  form.append("response_format", "verbose_json");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = (await res.json()) as { segments?: { start: number; text: string }[]; text?: string };
  if (json.segments?.length) {
    return {
      cues: json.segments.map((s) => ({ start: Math.round(s.start), text: s.text.trim() })),
      responseId: res.headers.get("x-request-id"),
      model: "whisper-large-v3",
    };
  }
  return {
    cues: json.text ? [{ start: 0, text: json.text }] : [],
    responseId: res.headers.get("x-request-id"),
    model: "whisper-large-v3",
  };
}

export async function transcribeUrl(
  url: string,
  config: TranscribeConfig,
): Promise<TranscriptCue[]> {
  if (config.maxDurationSeconds) {
    const duration = await videoDurationSeconds(url);
    // null means yt-dlp couldn't say — not a reason to refuse, since the
    // point of the cap is to skip streams we positively know are too long.
    if (duration !== null && duration > config.maxDurationSeconds) {
      throw new Error(
        `This video is ${Math.round(duration / 60)} minutes long, past the ` +
          `${Math.round(config.maxDurationSeconds / 60)}-minute cap on what gets transcribed.`,
      );
    }
  }

  const { path, cleanup } = await downloadAudio(url);
  try {
    const audio = await readFile(path);
    const result = config.provider === "deepgram"
      ? await deepgram(audio, config.apiKey)
      : await groqWhisper(audio, config.apiKey);
    const cues = normalizeTranscriptCues(result.cues);
    emitGenerationAudit(config.onGenerationAudit, providerGenerationAudit(
      config.provider,
      ASR_ADAPTER_PROMPT_VERSION,
      result.model,
      "video-audio-v1",
      cues.length > 0 ? "passed" : "rejected",
      { id: result.responseId, model: result.model },
    ));
    return cues;
  } catch (error) {
    emitGenerationAudit(config.onGenerationAudit, providerGenerationAudit(
      config.provider,
      ASR_ADAPTER_PROMPT_VERSION,
      config.provider === "deepgram" ? "nova-3" : "whisper-large-v3",
      "video-audio-v1",
      "rejected",
    ));
    throw error;
  } finally {
    await cleanup();
  }
}
