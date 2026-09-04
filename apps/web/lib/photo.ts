"use client";

/**
 * Shared client-side plumbing for the two photo-upload forms (recipe import,
 * recipe photo gallery) — one copy of the FileReader wrapper and the pick
 * validation, so a fix to one doesn't quietly need remembering for the other.
 */

/** A data: URL's own base64 payload, stripped of the `data:<type>;base64,` prefix. */
export function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Couldn't read that photo."));
    reader.onload = () => {
      const result = reader.result as string;
      const comma = result.indexOf(",");
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.readAsDataURL(file);
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
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

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
  }
}
