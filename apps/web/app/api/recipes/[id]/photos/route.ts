import { performance } from "node:perf_hooks";
import { NextResponse } from "next/server";
import { isPhotoMediaType, isUuid, MAX_PHOTO_BASE64_CHARS, PHOTO_MEDIA_TYPES } from "@seconds/core/format";
import { attachReservedRecipePhoto, reserveRecipePhotoUpload, removeRecipePhoto } from "@seconds/db";
import { BadRequestError, readJson, withUser } from "@/lib/api";
import { NotConfiguredError } from "@/lib/session";
import { createRecipePhotoKey, deleteRecipePhoto, r2Configured, uploadReservedRecipePhoto } from "@/lib/r2";

/** Your own photos of a recipe — separate from the one image a source page published. */
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

interface PhotoBody {
  imageBase64?: string;
  imageMediaType?: string;
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;

  const response = await withUser(async (userId, database) => {
    if (!r2Configured()) throw new NotConfiguredError("Photo uploads aren't set up yet.");
    if (!isUuid(id)) throw new BadRequestError("Choose a valid recipe.");
    const body = (await readJson<PhotoBody>(request)) ?? {};
    const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64.trim() : "";
    if (!imageBase64) throw new BadRequestError("Send a photo to upload.");
    if (!isPhotoMediaType(body.imageMediaType)) {
      throw new BadRequestError(`imageMediaType must be one of: ${PHOTO_MEDIA_TYPES.join(", ")}`);
    }
    if (imageBase64.length > MAX_PHOTO_BASE64_CHARS) {
      throw new BadRequestError("That photo is too large. Try a smaller image.");
    }

    if (request.signal.aborted) throw new BadRequestError("Photo upload was cancelled.");
    const key = createRecipePhotoKey(userId, id, body.imageMediaType);
    const reservationStarted = performance.now();
    const reserved = await reserveRecipePhotoUpload(database, userId, id, key);
    if (!reserved.ok) {
      if (reserved.reason === "at_limit") throw new BadRequestError("This recipe already has as many photos as it can hold, including uploads in progress.");
      return null;
    }
    // Do not start PUT after an unusually delayed reservation. DB completion
    // remains uncertain on disconnection; its key still belongs to recovery.
    if (performance.now() - reservationStarted > 30_000) {
      throw new Error("Photo upload reservation took too long; confirmation is unavailable.");
    }
    // Registration committed before SDK dispatch. Every later failure retains it.
    const bytes = Buffer.from(imageBase64, "base64");
    const { url } = await uploadReservedRecipePhoto(key, bytes, body.imageMediaType, request.signal);
    const result = await attachReservedRecipePhoto(database, userId, id, {
      key, url, createdAt: new Date().toISOString(),
    });
    if (!result.ok) {
      // Never erase here: an uncertain attachment commit may already be live.
      // The durable ledger and later live-reference check own reconciliation.
      if (result.reason === "at_limit") throw new BadRequestError("This recipe already has as many photos as it can hold.");
      return null;
    }
    return { photos: result.photos };
  }, { redactUnexpectedErrors: true });
  response.headers.set("Cache-Control", "no-store");
  return notFoundIfNull(response);
}

export async function DELETE(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await readJson<{ key?: string }>(request);

  const response = await withUser(async (userId, database) => {
    const key = body.key?.trim();
    if (!key) throw new BadRequestError("key is required.");

    const result = await removeRecipePhoto(database, userId, id, key);
    if (!result) return null;
    // Only ever delete from R2 when this recipe's own array actually had the
    // key. Owning *a* recipe isn't enough on its own — a key by itself is
    // just a string, and without this check anyone could pass a key copied
    // from a different recipe's photo (a public share exposes `url`, but
    // even `key` reaching a client some other way must not be trusted) and
    // have it delete a stranger's object.
    if (result.removed) await deleteRecipePhoto(key).catch(() => undefined);
    return { photos: result.photos };
  });
  return notFoundIfNull(response);
}

/**
 * `withUser` has no way to say "the user is fine but the recipe isn't there",
 * so a null payload means exactly that. Same convention as /api/recipes/[id].
 */
async function notFoundIfNull(response: NextResponse): Promise<NextResponse> {
  if (response.ok && (await response.clone().json()) === null) {
    return NextResponse.json({ error: "No such recipe." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return response;
}
