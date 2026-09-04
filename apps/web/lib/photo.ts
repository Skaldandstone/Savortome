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
