import "server-only";
import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { isUuid, type PhotoMediaType, type RecipePhoto } from "@seconds/core/format";
import { NotConfiguredError } from "./session.js";

/**
 * Cloudflare R2, when it's configured.
 *
 * Same shape as `stripe.ts`: photo uploads are optional in exactly the way
 * payments and the database are — the app runs without R2 set up, says which
 * variables are missing, and refuses the one route that needs it rather than
 * crashing at import time. R2 is S3-compatible, so this is the AWS SDK's S3
 * client pointed at Cloudflare's endpoint rather than AWS's.
 */

/**
 * Extends the shared `NotConfiguredError` (not a standalone class, the way
 * `StripeNotConfiguredError` was) so that if this is ever thrown somewhere
 * `errorResponse` catches it directly instead of behind an explicit
 * `r2Configured()` pre-check, it still maps to 501 rather than a generic 500.
 */
export class R2NotConfiguredError extends NotConfiguredError {
  constructor(missing: string[]) {
    super(
      `Photo uploads need Cloudflare R2. Set ${missing.join(", ")} in .env.local. ` +
        `Until then, recipes can still be saved — they just can't carry your own photos.`,
    );
    this.name = "R2NotConfiguredError";
  }
}

const missingVars = (): string[] =>
  [
    process.env.R2_ACCOUNT_ID ? null : "R2_ACCOUNT_ID",
    process.env.R2_ACCESS_KEY_ID ? null : "R2_ACCESS_KEY_ID",
    process.env.R2_SECRET_ACCESS_KEY ? null : "R2_SECRET_ACCESS_KEY",
    process.env.R2_BUCKET_NAME ? null : "R2_BUCKET_NAME",
    // The bucket's public URL — either R2's own r2.dev subdomain (fine for
    // development) or a custom domain mapped to the bucket in the Cloudflare
    // dashboard. Never derived automatically: a wrong guess here would silently
    // hand back photo links that 404.
    process.env.R2_PUBLIC_URL_BASE ? null : "R2_PUBLIC_URL_BASE",
  ].filter((v): v is string => v !== null);

export const r2Configured = (): boolean => missingVars().length === 0;

let client: S3Client | null = null;

function r2(): S3Client {
  const missing = missingVars();
  if (missing.length > 0) throw new R2NotConfiguredError(missing);
  // Built once, same reasoning as the Stripe client: a new client per request
  // leaks sockets under load.
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
  return client;
}

// Keyed by the canonical PhotoMediaType union (not a loose Record<string,
// string>), so adding a media type in packages/core without an extension
// here is a compile error instead of a silent runtime "Unsupported photo type".
const PHOTO_EXTENSIONS: Record<PhotoMediaType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Generate a server-owned key without touching storage; reserve it before PUT. */
export function createRecipePhotoKey(ownerId: string, recipeId: string, mediaType: PhotoMediaType): string {
  if (!isUuid(ownerId) || !isUuid(recipeId)) throw new Error("Invalid photo owner or recipe.");
  return `recipes/${ownerId}/${recipeId}/${randomUUID()}.${PHOTO_EXTENSIONS[mediaType]}`;
}

/** PUT only a previously reserved key. Caller must durably reserve before invoking.
 * A 12s caller deadline aborts SDK work; late completion is never attachment proof.
 * Real provider cancellation/late-write behavior remains an acceptance requirement.
 */
export async function uploadReservedRecipePhoto(
  key: string,
  bytes: Buffer,
  mediaType: PhotoMediaType,
  signal?: AbortSignal,
): Promise<{ key: string; url: string }> {
  const parts = key.split("/");
  const ext = PHOTO_EXTENSIONS[mediaType];
  if (parts.length !== 4 || parts[0] !== "recipes" || !isUuid(parts[1]) || !isUuid(parts[2]) ||
      !ext || !parts[3]?.endsWith(`.${ext}`) || !isUuid(parts[3].slice(0, -(ext.length + 1)))) {
    throw new Error("Invalid reserved photo key.");
  }
  if (signal?.aborted) throw new Error("Photo upload was aborted.");
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  try {
    const interrupted = new Promise<never>((_, reject) => {
      abort = () => {
        controller.abort();
        reject(new Error("Photo upload was interrupted; confirmation is unavailable."));
      };
      signal?.addEventListener("abort", abort, { once: true });
      timer = setTimeout(abort, 12_000);
    });
    await Promise.race([
      r2().send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME, Key: key, Body: bytes, ContentType: mediaType,
      }), { abortSignal: controller.signal }),
      interrupted,
    ]);
    if (controller.signal.aborted) throw new Error("Photo upload confirmation is unavailable.");
    const base = process.env.R2_PUBLIC_URL_BASE!.replace(/\/$/, "");
    return { key, url: `${base}/${key}` };
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    if (abort) signal?.removeEventListener("abort", abort);
  }
}

/** Delete one recipe photo. Not fatal if it's already gone. */
export async function deleteRecipePhoto(key: string, signal?: AbortSignal): Promise<void> {
  // Refuse an already-expired operation before even creating a storage client.
  if (signal?.aborted) throw new Error("Photo deletion was aborted.");
  await r2().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }), {
    abortSignal: signal,
  });
}

/**
 * Delete every photo a just-deleted recipe (or a just-deleted account's
 * recipes) was carrying. Best-effort by design, not by accident: the row
 * these photos belonged to is already gone by the time a caller has this
 * list, so a failed R2 delete here just leaves an orphaned object rather
 * than blocking or undoing a delete that already happened. One shared place
 * for that policy, rather than each deletion path re-deciding it.
 */
export async function deleteRecipePhotos(photos: readonly RecipePhoto[]): Promise<void> {
  await Promise.all(photos.map((photo) => deleteRecipePhoto(photo.key).catch(() => undefined)));
}
