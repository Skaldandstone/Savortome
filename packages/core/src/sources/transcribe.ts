import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TranscriptCue } from "./types.js";
import { parseJson3Cues } from "./youtube.js";

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
}

export function asrConfigFromEnv(env: NodeJS.ProcessEnv = process.env): TranscribeConfig | null {
  if (env.DEEPGRAM_API_KEY) return { provider: "deepgram", apiKey: env.DEEPGRAM_API_KEY };
  if (env.GROQ_API_KEY) return { provider: "groq", apiKey: env.GROQ_API_KEY };
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
  const dir = await mkdtemp(join(tmpdir(), "nomnom-subs-"));

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

/** Download the audio track only — far smaller and faster than the full video. */
async function downloadAudio(url: string): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), "nomnom-"));
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

async function deepgram(audio: Buffer, apiKey: string): Promise<TranscriptCue[]> {
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
    return sentences.map((s) => ({ start: Math.round(s.start), text: s.text }));
  }
  return alt?.transcript ? [{ start: 0, text: alt.transcript }] : [];
}

async function groqWhisper(audio: Buffer, apiKey: string): Promise<TranscriptCue[]> {
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
    return json.segments.map((s) => ({ start: Math.round(s.start), text: s.text.trim() }));
  }
  return json.text ? [{ start: 0, text: json.text }] : [];
}

export async function transcribeUrl(
  url: string,
  config: TranscribeConfig,
): Promise<TranscriptCue[]> {
  const { path, cleanup } = await downloadAudio(url);
  try {
    const audio = await readFile(path);
    return config.provider === "deepgram"
      ? await deepgram(audio, config.apiKey)
      : await groqWhisper(audio, config.apiKey);
  } finally {
    await cleanup();
  }
}
