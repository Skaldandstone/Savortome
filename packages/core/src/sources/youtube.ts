import { fetchJson, fetchText } from "./fetch.js";
import type { TranscriptCue } from "./types.js";
import { youtubeVideoId } from "../source-kind.js";

export { youtubeVideoId };

interface Json3Event {
  tStartMs?: number;
  segs?: { utf8?: string }[];
}

interface CaptionTrack {
  baseUrl: string;
  languageCode?: string;
  kind?: string;
  name?: { simpleText?: string };
}

export interface YoutubeMeta {
  title: string | null;
  author: string | null;
  description: string | null;
  thumbnail: string | null;
  cues: TranscriptCue[] | null;
}

/** Pull the embedded player JSON out of the watch page HTML. */
function playerResponse(html: string): Record<string, unknown> | null {
  const m =
    /ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;\s*(?:var|const|let|<\/script>)/s.exec(html) ??
    /ytInitialPlayerResponse\s*=\s*(\{.+?\});/s.exec(html);
  if (!m) return null;
  try {
    return JSON.parse(m[1] as string) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Prefer a human-written English track; fall back to any track, ASR included. */
function pickTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  if (!tracks.length) return null;
  const en = tracks.filter((t) => (t.languageCode ?? "").startsWith("en"));
  const pool = en.length ? en : tracks;
  return pool.find((t) => t.kind !== "asr") ?? pool[0] ?? null;
}

export async function fetchYoutube(url: string): Promise<YoutubeMeta> {
  const id = youtubeVideoId(url);
  if (!id) throw new Error(`Not a YouTube URL: ${url}`);

  const html = await fetchText(`https://www.youtube.com/watch?v=${id}`, {
    headers: { "accept-language": "en-US,en;q=0.9" },
  });
  const pr = playerResponse(html);

  const details = (pr?.videoDetails ?? {}) as Record<string, unknown>;
  const title = (details.title as string | undefined) ?? null;
  const author = (details.author as string | undefined) ?? null;
  const description = (details.shortDescription as string | undefined) ?? null;
  const thumbnail = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;

  const tracks =
    (((pr?.captions as Record<string, unknown> | undefined)?.playerCaptionsTracklistRenderer as
      | Record<string, unknown>
      | undefined)?.captionTracks as CaptionTrack[] | undefined) ?? [];

  const track = pickTrack(tracks);
  let cues: TranscriptCue[] | null = null;

  if (track?.baseUrl) {
    try {
      const data = await fetchJson<{ events?: Json3Event[] }>(`${track.baseUrl}&fmt=json3`);
      cues = (data.events ?? [])
        .map((e) => ({
          start: Math.round((e.tStartMs ?? 0) / 1000),
          text: (e.segs ?? []).map((s) => s.utf8 ?? "").join("").replace(/\s+/g, " ").trim(),
        }))
        .filter((c) => c.text.length > 0);
      if (cues.length === 0) cues = null;
    } catch {
      cues = null; // caption endpoints rotate; the caller falls back to ASR or the description
    }
  }

  return { title, author, description, thumbnail, cues };
}

/** Merge word-level cues into readable sentences, keeping the start time of each chunk. */
export function coalesceCues(cues: TranscriptCue[], maxChars = 220): TranscriptCue[] {
  const out: TranscriptCue[] = [];
  let buf = "";
  let start = cues[0]?.start ?? 0;

  for (const c of cues) {
    if (buf && (buf.length + c.text.length > maxChars || /[.!?]$/.test(buf))) {
      out.push({ start, text: buf.trim() });
      buf = "";
      start = c.start;
    }
    if (!buf) start = c.start;
    buf += (buf ? " " : "") + c.text;
  }
  if (buf.trim()) out.push({ start, text: buf.trim() });
  return out;
}

/** Render cues as `[mm:ss] text` lines so the model can cite timestamps back to us. */
export function cuesToTranscript(cues: TranscriptCue[]): string {
  return coalesceCues(cues)
    .map(({ start, text }) => {
      const m = Math.floor(start / 60);
      const s = start % 60;
      return `[${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}] ${text}`;
    })
    .join("\n");
}
