import { NextResponse } from "next/server";
import { addRecipePhoto, removeRecipePhoto } from "@seconds/db";
import { BadRequestError, readJson, withUser } from "@/lib/api";
import { deleteRecipePhoto, r2Configured, uploadRecipePhoto } from "@/lib/r2";

/** Your own photos of a recipe — separate from the one image a source page published. */
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

const PHOTO_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type PhotoMediaType = (typeof PHOTO_MEDIA_TYPES)[number];
const isPhotoMediaType = (v: unknown): v is PhotoMediaType =>
  (PHOTO_MEDIA_TYPES as readonly unknown[]).includes(v);
// Bounds memory and R2 cost per request, not a real constraint on a phone photo.
const MAX_PHOTO_BASE64_CHARS = 12_000_000; // ~9 MB decoded

interface PhotoBody {
  imageBase64?: string;
  imageMediaType?: string;
}

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;

  if (!r2Configured()) {
    return NextResponse.json(
      { error: "Photo uploads aren't set up yet. Set the R2_* variables in .env.local." },
      { status: 501 },
    );
  }

  const body = await readJson<PhotoBody>(request);
  const response = await withUser(async (userId, database) => {
    const imageBase64 = body.imageBase64?.trim();
    if (!imageBase64) throw new BadRequestError("Send a photo to upload.");
    if (!isPhotoMediaType(body.imageMediaType)) {
      throw new BadRequestError(`imageMediaType must be one of: ${PHOTO_MEDIA_TYPES.join(", ")}`);
    }
    if (imageBase64.length > MAX_PHOTO_BASE64_CHARS) {
      throw new BadRequestError("That photo is too large. Try a smaller image.");
    }

    const bytes = Buffer.from(imageBase64, "base64");
    const { key, url } = await uploadRecipePhoto(userId, id, bytes, body.imageMediaType);

    const photos = await addRecipePhoto(database, userId, id, {
      key,
      url,
      createdAt: new Date().toISOString(),
    });
    if (!photos) {
      // The recipe vanished (or was never this user's) between the upload and
      // the write. The upload already happened, so clean up rather than leave
      // an orphaned object nothing will ever list or delete.
      await deleteRecipePhoto(key).catch(() => undefined);
      return null;
    }
    return { photos };
  });
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
    return NextResponse.json({ error: "No such recipe." }, { status: 404 });
  }
  return response;
}
