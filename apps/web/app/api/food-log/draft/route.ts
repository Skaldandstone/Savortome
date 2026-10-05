import { extractFoodPhoto, extractFoodVoice, isPhotoMediaType } from "@seconds/core";
import { BadRequestError, withUser } from "@/lib/api";
import { boundedJson } from "@/lib/bounded-json";
import { recordGenerationAudit } from "@/lib/generation-audit";
import { NotConfiguredError } from "@/lib/session";
import { matchesFoodMediaHeader } from "@/lib/food-media";
export const runtime = "nodejs";
const status = () => ({ photo: process.env.FOOD_PHOTO_ENABLED === "true" && Boolean(process.env.OPENAI_API_KEY?.trim()), voice: process.env.FOOD_VOICE_ENABLED === "true" && Boolean(process.env.OPENAI_API_KEY?.trim()) });
const privateResponse = (response: Response) => { response.headers.set("Cache-Control", "private, no-store"); return response; };
export async function GET() { return privateResponse(await withUser(async () => status(), { redactUnexpectedErrors: true })); }
export async function POST(request: Request) {
  return privateResponse(await withUser(async () => {
    const enabled = status();
    if (!enabled.photo && !enabled.voice) throw new NotConfiguredError("Photo and voice food notes are not enabled. You can type a note.");
    const body = await boundedJson(request, 12_000_000);
    if (body.source !== "photo" && body.source !== "voice") throw new BadRequestError("Choose a photo or voice note.");
    if (!enabled[body.source]) throw new NotConfiguredError("This capture option is not enabled. You can type a note.");
    const max = body.source === "photo" ? 8_000_000 : 5_000_000;
    if (typeof body.base64 !== "string" || body.base64.length === 0 || body.base64.length % 4 !== 0) throw new BadRequestError("That file could not be read.");
    if (body.base64.length > Math.ceil(max / 3) * 4) throw new BadRequestError("That file is empty or too large.");
    // Avoid repeated-group regex recursion on multi-megabyte uploads. Padding
    // may only be the final one or two characters, after a complete quartet.
    const padding = body.base64.endsWith("==") ? 2 : body.base64.endsWith("=") ? 1 : 0;
    const paddingStart = body.base64.indexOf("=");
    if (/[^A-Za-z0-9+/=]/.test(body.base64) || (paddingStart !== -1 && paddingStart !== body.base64.length - padding)) throw new BadRequestError("That file could not be read.");
    const bytes = Buffer.from(body.base64, "base64");
    if (!bytes.length || bytes.length > max) throw new BadRequestError("That file is empty or too large.");
    const options = { onGenerationAudit: recordGenerationAudit, signal: AbortSignal.timeout(body.source === "photo" ? 40_000 : 70_000) };
    if (body.source === "photo") {
      if (!isPhotoMediaType(body.mediaType)) throw new BadRequestError("Choose a JPEG, PNG or WebP food photo.");
      if (!matchesFoodMediaHeader(bytes, body.mediaType)) throw new BadRequestError("That file does not match its photo format. Choose another photo or type a note.");
      return { draft: await extractFoodPhoto(body.base64, body.mediaType, options) };
    }
    if (typeof body.mediaType !== "string" || !["audio/webm", "audio/mp4", "audio/mpeg", "audio/wav"].includes(body.mediaType)) throw new BadRequestError("Choose a supported audio recording.");
    if (!matchesFoodMediaHeader(bytes, body.mediaType)) throw new BadRequestError("That file does not match its audio format. Record a new note or type one.");
    // Upload bytes and transcript are transient; only explicit later saves store a reviewed note.
    return { draft: await extractFoodVoice(bytes, body.mediaType, options) };
  }, { redactUnexpectedErrors: true }));
}
