import "server-only";
import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { PhotoMediaType } from "@seconds/core";
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

/** Upload one recipe photo. Returns the object key and its public URL. */
export async function uploadRecipePhoto(
  ownerId: string,
  recipeId: string,
  bytes: Buffer,
  mediaType: PhotoMediaType,
): Promise<{ key: string; url: string }> {
  const ext = PHOTO_EXTENSIONS[mediaType];

  // Namespaced by owner, not just recipe: a deleted account's cleanup job (if
  // one is ever written) can find everything under one prefix instead of
  // scanning the whole bucket for a matching recipeId.
  const key = `recipes/${ownerId}/${recipeId}/${randomUUID()}.${ext}`;

  await r2().send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: bytes,
      ContentType: mediaType,
    }),
  );

  const base = process.env.R2_PUBLIC_URL_BASE!.replace(/\/$/, "");
  return { key, url: `${base}/${key}` };
}

/** Delete one recipe photo. Not fatal if it's already gone. */
export async function deleteRecipePhoto(key: string): Promise<void> {
  await r2().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
}
