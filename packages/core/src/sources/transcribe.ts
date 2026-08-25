import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TranscriptCue } from "./types.js";

/**
 * Last-resort path for videos with no captions and no useful caption text:
 * pull the audio with yt-dlp, run it through an ASR provider, and hand the
 * resulting cues to the same extractor the caption path uses.
 *
 * Requires `yt-dlp` (and ffmpeg) on PATH plus an ASR key. Both are optional —
 * without them the pipeline degrades to caption/description extraction instead
 * of failing, so a deploy with neither still works for most links.
 */

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
    await run("yt-dlp", ["--version"], 15_000);
    return true;
  } catch {
    return false;
  }
}

/** Download the audio track only — far smaller and faster than the full video. */
async function downloadAudio(url: string): Promise<{ path: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), "nomnom-"));
  const path = join(dir, "audio.m4a");
  await run("yt-dlp", [
    "-f", "bestaudio[ext=m4a]/bestaudio",
    "-x", "--audio-format", "m4a",
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
