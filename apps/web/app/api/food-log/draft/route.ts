import { extractFoodPhoto, extractFoodVoice, isPhotoMediaType } from "@seconds/core";
import { BadRequestError, withUser } from "@/lib/api";
import { boundedJson } from "@/lib/bounded-json";
import { recordGenerationAudit } from "@/lib/generation-audit";
import { NotConfiguredError } from "@/lib/session";
export const runtime = "nodejs";
const status = () => ({ photo: process.env.FOOD_PHOTO_ENABLED === "true" && Boolean(process.env.OPENAI_API_KEY?.trim()), voice: process.env.FOOD_VOICE_ENABLED === "true" && Boolean(process.env.OPENAI_API_KEY?.trim()) });
const privateResponse = (response: Response) => { response.headers.set("Cache-Control", "private, no-store"); return response; };
export async function GET() { return privateResponse(await withUser(async () => status())); }
export async function POST(request: Request) {
  return privateResponse(await withUser(async () => {
    const enabled = status();
    if (!enabled.photo && !enabled.voice) throw new NotConfiguredError("Photo and voice food notes are not enabled. You can type a note.");
    const body = await boundedJson(request, 12_000_000);
    if (body.source !== "photo" && body.source !== "voice") throw new BadRequestError("Choose a photo or voice note.");
    if (!enabled[body.source]) throw new NotConfiguredError("This capture option is not enabled. You can type a note.");
    if (typeof body.base64 !== "string" || body.base64.length === 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(body.base64)) throw new BadRequestError("That file could not be read.");
    const bytes = Buffer.from(body.base64, "base64");
    const max = body.source === "photo" ? 8_000_000 : 5_000_000;
    if (!bytes.length || bytes.length > max) throw new BadRequestError("That file is empty or too large.");
    const options = { onGenerationAudit: recordGenerationAudit, signal: AbortSignal.timeout(body.source === "photo" ? 40_000 : 70_000) };
    if (body.source === "photo") {
      if (!isPhotoMediaType(body.mediaType)) throw new BadRequestError("Choose a JPEG, PNG or WebP food photo.");
      return { draft: await extractFoodPhoto(body.base64, body.mediaType, options) };
    }
    if (typeof body.mediaType !== "string" || !["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav"].includes(body.mediaType)) throw new BadRequestError("Choose a supported audio recording.");
    // Upload bytes and transcript are transient; only explicit later saves store a reviewed note.
    return { draft: await extractFoodVoice(bytes, body.mediaType, options) };
  }));
}
