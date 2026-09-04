"use client";

import { useRef, useState } from "react";
import { isPhotoMediaType, MAX_PHOTO_BYTES, type RecipePhoto } from "@seconds/core/format";
import { Callout } from "@/ui";
import { api } from "@/lib/client";
import { compressForUpload, readAsBase64 } from "@/lib/photo";
import styles from "./recipe.module.css";

// A sanity bound before even trying to decode, not the real limit — a modern
// phone photo comfortably clears this; it exists to avoid asking the browser
// to decode something absurd. The real limit is checked after compression,
// below, since that's the number that actually determines what gets sent.
const MAX_PHOTO_BYTES_BEFORE_COMPRESSION = 50_000_000;

/** Your own photos of the finished dish — separate from a source page's own image. */
export function RecipePhotos({ recipeId, initial }: { recipeId: string; initial: RecipePhoto[] }) {
  const [photos, setPhotos] = useState(initial);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function pickPhoto(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!isPhotoMediaType(file.type)) {
      setError("That doesn't look like a photo. Try a JPEG, PNG, or WebP.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES_BEFORE_COMPRESSION) {
      setError("That photo is too large. Try a smaller image.");
      return;
    }
    setUploading(true);
    try {
      // Downscale/re-encode first — most real phone photos shrink well
      // under the limit this way, so the size check that matters is the one
      // after compression, not the one on what the camera originally produced.
      const compressed = await compressForUpload(file);
      if (compressed.size > MAX_PHOTO_BYTES) {
        setError("That photo is too large even compressed. Try a smaller image.");
        return;
      }
      // compressForUpload only ever produces the original (already-validated)
      // type or re-encodes to image/jpeg, but re-checking rather than casting
      // keeps this honest if that ever changes.
      if (!isPhotoMediaType(compressed.type)) {
        setError("Couldn't prepare that photo for upload. Try again.");
        return;
      }
      const base64 = await readAsBase64(compressed);
      const { photos: updated } = await api.addRecipePhoto(recipeId, base64, compressed.type);
      setPhotos(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that photo.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function remove(key: string) {
    setError(null);
    setBusyKey(key);
    try {
      const { photos: updated } = await api.removeRecipePhoto(recipeId, key);
      setPhotos(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove that photo.");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <section className={styles.journalPage} aria-label="Your photos" data-print="hide">
      <h3 className={styles.sectionTitle}>Your photos</h3>
      {photos.length > 0 ? (
        <ul className={styles.photoGrid}>
          {photos.map((photo) => (
            <li key={photo.key} className={styles.photoTile}>
              {/* eslint-disable-next-line @next/next/no-img-element -- an R2 URL, not a Next-optimized asset */}
              <img src={photo.url} alt="" className={styles.photoImg} />
              <button
                type="button"
                className={styles.photoRemove}
                aria-label="Remove this photo"
                disabled={busyKey === photo.key}
                onClick={() => void remove(photo.key)}
              >
                {busyKey === photo.key ? "…" : "×"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.note}>No photos yet — add one from your kitchen or your camera roll.</p>
      )}
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        aria-label="Add a photo of this dish"
        disabled={uploading}
        onChange={(e) => void pickPhoto(e.target.files?.[0])}
      />
      {uploading ? <p className={styles.note} role="status">Uploading…</p> : null}
      {error ? <Callout tone="error" role="alert">{error}</Callout> : null}
    </section>
  );
}
