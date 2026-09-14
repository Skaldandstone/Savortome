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
import { BadRequestError, readJson, withUser } from "@/lib/api";
import { NotConfiguredError } from "@/lib/session";
import { recordGenerationAudit } from "@/lib/generation-audit";

export const runtime = "nodejs";

const enabled = () =>
  process.env.RECEIPT_SCAN_ENABLED === "true" && Boolean(process.env.ANTHROPIC_API_KEY);

export async function GET() {
  return withUser(async () => ({ enabled: enabled() }));
}

export async function POST(request: Request) {
  return withUser(async (userId, database) => {
    if (!enabled()) {
      throw new NotConfiguredError("Receipt scanning is not enabled for this build.");
    }

    // Authentication above happens before the request body is decoded or any
    // metered model call can begin.
    const body = await readJson<Record<string, unknown>>(request);
    if (typeof body.imageBase64 !== "string" || body.imageBase64.length === 0) {
      throw new BadRequestError("Choose a receipt photo to scan.");
    }
    if (body.imageBase64.length > MAX_PHOTO_BASE64_CHARS) {
      throw new BadRequestError("That receipt photo is too large.");
    }
    if (!isPhotoMediaType(body.imageMediaType)) {
      throw new BadRequestError("Use a JPEG, PNG, or WebP receipt photo.");
    }
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(body.imageBase64)) {
      throw new BadRequestError("That receipt photo could not be read.");
    }
    const bytes = Buffer.from(body.imageBase64, "base64");
    if (bytes.length === 0 || bytes.length > MAX_PHOTO_BYTES) {
      throw new BadRequestError("That receipt photo is empty or too large.");
    }

    const extraction = await extractReceiptPhoto(
      body.imageBase64,
      body.imageMediaType as PhotoMediaType,
      { onGenerationAudit: recordGenerationAudit },
    );
    const intake = await createPantryIntake(database, userId, parsePantryIntake({
      source: "receipt",
      externalReference: createHash("sha256").update(bytes).digest("hex"),
      sourceLabel: extraction.sourceLabel,
      acquiredAt: null,
      items: extraction.items,
    }));

    // The photo and its base64 representation are intentionally not persisted.
    return { intake, intakes: await listPendingPantryIntakes(database, userId) };
  });
}
