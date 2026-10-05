"use client";

/**
 * Shared client-side plumbing for the two photo-upload forms (recipe import,
 * recipe photo gallery) — one copy of the FileReader wrapper and the pick
 * validation, so a fix to one doesn't quietly need remembering for the other.
 */

/** A data: URL's own base64 payload, stripped of the `data:<type>;base64,` prefix. */
export function readAsBase64(file: File, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    let settled = false;
    const finish = (error: Error | null, payload?: string) => {
      if (settled) return;
      settled = true;
      reader.onload = reader.onerror = reader.onabort = null;
      signal?.removeEventListener("abort", cancel);
      if (error) reject(error);
      else resolve(payload!);
    };
    const cancel = () => {
      if (settled) return;
      finish(new Error("Reading that photo was cancelled."));
      // Detach first: abort must not re-enter settlement or surface raw errors.
      try { reader.abort(); } catch { /* already settled; nothing may submit */ }
    };
    if (signal?.aborted) { cancel(); return; }
    signal?.addEventListener("abort", cancel, { once: true });
    reader.onerror = () => finish(new Error("Couldn't read that photo."));
    reader.onabort = () => finish(new Error("Reading that photo was cancelled."));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") { finish(new Error("Couldn't read that photo.")); return; }
      const comma = result.indexOf(",");
      finish(null, comma === -1 ? result : result.slice(comma + 1));
    };
    try { reader.readAsDataURL(file); }
    catch { finish(new Error("Couldn't read that photo.")); }
  });
}

/**
 * Downscale and re-encode a photo before it's uploaded, so a 12MP+ phone
 * photo (often 8-20MB straight off the camera) doesn't blow past the upload
 * limit or cost more R2 storage/bandwidth than a recipe photo needs.
 *
 * Deliberately **not** used on the scan-import path (a photo of a recipe
 * card, read by Claude's vision API): a canvas-re-encoded JPEG can carry an
 * embedded color profile the API rejects outright with "Could not process
 * image" — measured directly against a canvas.toBlob('image/jpeg') output
 * during this feature's own testing, where the same pixels as a PNG worked
 * fine. That path sends the camera's own bytes untouched on purpose. This
 * function is for the recipe-photo gallery instead, where the only consumer
 * is a browser `<img>` tag and re-encoding is unconditionally safe.
 *
 * `imageOrientation: "from-image"` bakes in the photo's EXIF rotation before
 * drawing to canvas — canvas output has no EXIF of its own, so skipping this
 * would turn a correctly-oriented portrait photo sideways.
 *
 * Never returns something bigger than it started with: if compression
 * doesn't help (already small, or an unusual format canvas doesn't shrink
 * well), the original file is returned untouched rather than uploading a
 * "compressed" file that's actually larger.
 */
export async function compressForUpload(
  file: File,
  { maxDimension = 1600, quality = 0.85 }: { maxDimension?: number; quality?: number } = {},
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    bitmap = undefined;

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
  } catch {
    // A decode failure (corrupt file, unsupported format, no canvas support)
    // must fall back to the original rather than block the upload entirely —
    // the server's own type/size validation is still the real gate.
    return file;
  } finally {
    // Also release the decoded bitmap if canvas creation/drawing/encoding fails.
    bitmap?.close();
  }
}
