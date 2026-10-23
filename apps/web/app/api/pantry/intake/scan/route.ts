import { createHash } from "node:crypto";
import {
  extractReceiptPhoto,
  isPhotoMediaType,
  MAX_PHOTO_BASE64_CHARS,
  MAX_PHOTO_BYTES,
  parsePantryIntake,
  type PhotoMediaType,
} from "@seconds/core";
import { createPantryIntake, listPendingPantryIntakes } from "@seconds/db";
import { BadRequestError, withUser } from "@/lib/api";
import { boundedJson } from "@/lib/bounded-json";
import { NotConfiguredError } from "@/lib/session";
import { recordGenerationAudit } from "@/lib/generation-audit";

export const runtime = "nodejs";

const enabled = () =>
  process.env.RECEIPT_SCAN_ENABLED === "true" && Boolean(process.env.OPENAI_API_KEY?.trim());

const privateResponse = (response: Response) => { response.headers.set("Cache-Control", "private, no-store"); return response; };
const requireActiveScan = (signal: AbortSignal) => {
  if (signal.aborted) throw new BadRequestError("That receipt scan was interrupted. Check your reviews before trying again.");
};
export async function GET() {
  return privateResponse(await withUser(async () => ({ enabled: enabled() }), { redactUnexpectedErrors: true }));
}

export async function POST(request: Request) {
  return privateResponse(await withUser(async (userId, database) => {
    if (!enabled()) {
      throw new NotConfiguredError("Receipt scanning is not enabled for this build.");
    }

    // Authentication above happens before the request body is decoded or any
    // metered model call can begin.
    requireActiveScan(request.signal);
    const body = await boundedJson(request, MAX_PHOTO_BASE64_CHARS + 4096);
    requireActiveScan(request.signal);
    if (typeof body.imageBase64 !== "string" || body.imageBase64.length === 0) {
      throw new BadRequestError("Choose a receipt photo to scan.");
    }
    if (body.imageBase64.length > MAX_PHOTO_BASE64_CHARS) {
      throw new BadRequestError("That receipt photo is too large.");
    }
    if (!isPhotoMediaType(body.imageMediaType)) {
      throw new BadRequestError("Use a JPEG, PNG, or WebP receipt photo.");
    }
    // Avoid repeated-group regex recursion on multi-megabyte receipt photos.
    if (body.imageBase64.length % 4 !== 0) throw new BadRequestError("That receipt photo could not be read.");
    const padding = body.imageBase64.endsWith("==") ? 2 : body.imageBase64.endsWith("=") ? 1 : 0;
    const paddingStart = body.imageBase64.indexOf("=");
    if (/[^A-Za-z0-9+/=]/.test(body.imageBase64) || (paddingStart !== -1 && paddingStart !== body.imageBase64.length - padding)) {
      throw new BadRequestError("That receipt photo could not be read.");
    }
    const bytes = Buffer.from(body.imageBase64, "base64");
    if (bytes.length === 0 || bytes.length > MAX_PHOTO_BYTES) {
      throw new BadRequestError("That receipt photo is empty or too large.");
    }

    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(40_000)]);
    requireActiveScan(signal);
    const extraction = await extractReceiptPhoto(
      body.imageBase64,
      body.imageMediaType as PhotoMediaType,
      { onGenerationAudit: recordGenerationAudit, signal },
    );
    requireActiveScan(signal);
    const intake = await createPantryIntake(database, userId, parsePantryIntake({
      source: "receipt",
      externalReference: createHash("sha256").update(bytes).digest("hex"),
      sourceLabel: extraction.sourceLabel,
      acquiredAt: null,
      items: extraction.items,
    }));

    // The photo and its base64 representation are intentionally not persisted.
    return { intake, intakes: await listPendingPantryIntakes(database, userId) };
  }, { redactUnexpectedErrors: true }));
}
