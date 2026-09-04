"use client";

import { useRef, useState } from "react";
import type { RecipePhoto } from "@seconds/core/format";
import { Callout } from "@/ui";
import { api } from "@/lib/client";
import styles from "./recipe.module.css";

const PHOTO_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type PhotoMediaType = (typeof PHOTO_MEDIA_TYPES)[number];
const isPhotoMediaType = (v: string): v is PhotoMediaType =>
  (PHOTO_MEDIA_TYPES as readonly string[]).includes(v);
const MAX_PHOTO_BYTES = 9_000_000;

function readAsBase64(file: File): Promise<string> {
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
    if (file.size > MAX_PHOTO_BYTES) {
      setError("That photo is too large. Try a smaller image.");
      return;
    }
    setUploading(true);
    try {
      const base64 = await readAsBase64(file);
      const { photos: updated } = await api.addRecipePhoto(recipeId, base64, file.type);
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
