"use client";

import { useRef, useState } from "react";
import { Button, Callout, FieldRow, TextArea, TextField } from "@/ui";
import { ModeSwitch } from "./ModeSwitch";
import { hintForUrl, type ImportMode, type ImportRequest } from "@seconds/core/format";
import styles from "./import.module.css";

const PHOTO_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type PhotoMediaType = (typeof PHOTO_MEDIA_TYPES)[number];
const isPhotoMediaType = (v: string): v is PhotoMediaType =>
  (PHOTO_MEDIA_TYPES as readonly string[]).includes(v);
const MAX_PHOTO_BYTES = 9_000_000;

/** A data: URL's own base64 payload, stripped of the `data:<type>;base64,` prefix. */
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

export function ImportForm({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (request: ImportRequest) => void;
}) {
  const [mode, setMode] = useState<ImportMode>("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState<{ preview: string; base64: string; mediaType: PhotoMediaType } | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const hint = mode === "url" ? hintForUrl(url) : undefined;

  async function pickPhoto(file: File | undefined) {
    setPhotoError(null);
    if (!file) return;
    if (!isPhotoMediaType(file.type)) {
      setPhotoError("That doesn't look like a photo. Try a JPEG, PNG, or WebP.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError("That photo is too large. Try a smaller image.");
      return;
    }
    // Revoke the previous preview before replacing it — an object URL that's
    // never released is a small leak that adds up over a session of retries.
    setPhoto((prev) => {
      if (prev) URL.revokeObjectURL(prev.preview);
      return prev;
    });
    try {
      const base64 = await readAsBase64(file);
      setPhoto({ preview: URL.createObjectURL(file), base64, mediaType: file.type });
    } catch {
      setPhotoError("Couldn't read that photo. Try again.");
    }
  }

  const canSubmit =
    mode === "url" ? !!url : mode === "text" ? !!text : mode === "photo" ? !!photo : false;

  return (
    <>
      <ModeSwitch
        mode={mode}
        onChange={(next) => {
          setMode(next);
          setPhotoError(null);
        }}
      />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (busy || !canSubmit) return;
          if (mode === "url") onSubmit({ url });
          else if (mode === "text") onSubmit({ text });
          else if (photo) onSubmit({ imageBase64: photo.base64, imageMediaType: photo.mediaType });
        }}
      >
        <FieldRow>
          {mode === "url" ? (
            <TextField
              type="url"
              aria-label="Recipe URL"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              required
              disabled={busy}
            />
          ) : mode === "text" ? (
            <TextArea
              aria-label="Recipe text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste a recipe, a screenshot transcription, or a text from your mum."
              required
              disabled={busy}
            />
          ) : (
            <div className={styles.photoPicker}>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                aria-label="Photo of a recipe card, cookbook page, or handwritten note"
                disabled={busy}
                onChange={(e) => void pickPhoto(e.target.files?.[0])}
              />
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element -- a local object URL, not a remote image
                <img src={photo.preview} alt="Selected recipe photo" className={styles.photoPreview} />
              ) : null}
            </div>
          )}
          <Button type="submit" disabled={busy || !canSubmit}>
            {busy ? "Importing…" : "Import"}
          </Button>
        </FieldRow>
      </form>

      {photoError ? <Callout tone="error" role="alert">{photoError}</Callout> : null}
      {hint && !busy ? <p className={styles.sourceHint}>{hint}</p> : null}
    </>
  );
}
