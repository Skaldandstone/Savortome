"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Callout, FieldRow, TextArea, TextField } from "@/ui";
import { ModeSwitch } from "./ModeSwitch";
import {
  hintForUrl,
  isPhotoMediaType,
  MAX_PHOTO_BYTES,
  type ImportMode,
  type ImportRequest,
  type PhotoMediaType,
} from "@seconds/core/format";
import { readAsBase64 } from "@/lib/photo";
import styles from "./import.module.css";

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

  const [preparing, setPreparing] = useState(false);
  const alive = useRef(true);
  const generation = useRef(0);
  const reading = useRef(false);
  const preview = useRef<string | null>(null);
  const selected = useRef<typeof photo>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function discardPhoto() {
    generation.current++;
    reading.current = false;
    selected.current = null;
    if (timer.current !== undefined) clearTimeout(timer.current);
    timer.current = undefined;
    if (preview.current) URL.revokeObjectURL(preview.current);
    preview.current = null;
  }
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; discardPhoto(); };
  }, []);

  const hint = mode === "url" ? hintForUrl(url) : undefined;

  async function pickPhoto(file: File | undefined) {
    if (!file || busy || !alive.current) return;
    discardPhoto();
    setPhoto(null); setPreparing(false); setPhotoError(null);
    if (!isPhotoMediaType(file.type)) {
      setPhotoError("That doesn't look like a photo. Try a JPEG, PNG, or WebP.");
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError("That photo is too large. Try a smaller image.");
      return;
    }
    const version = generation.current;
    reading.current = true; setPreparing(true);
    try {
      // Bound the caller; FileReader itself may finish after abandonment.
      const base64 = await Promise.race([
        readAsBase64(file),
        new Promise<never>((_, reject) => {
          timer.current = setTimeout(() => reject(new Error("Photo read timed out.")), 30_000);
        }),
      ]);
      if (!alive.current || version !== generation.current) return;
      const next = { preview: URL.createObjectURL(file), base64, mediaType: file.type };
      preview.current = next.preview; selected.current = next; setPhoto(next);
    } catch {
      if (alive.current && version === generation.current) setPhotoError("Couldn't read that photo. Try again.");
    } finally {
      if (alive.current && version === generation.current) {
        if (timer.current !== undefined) clearTimeout(timer.current);
        timer.current = undefined;
        reading.current = false; setPreparing(false);
        if (fileInput.current) fileInput.current.value = "";
      }
    }
  }

  const canSubmit =
    mode === "url" ? !!url : mode === "text" ? !!text : mode === "photo" ? !!photo && !preparing : false;

  return (
    <>
      <ModeSwitch
        mode={mode}
        onChange={(next) => {
          if (busy || next === mode) return;
          discardPhoto(); setPhoto(null); setPreparing(false);
          setMode(next);
          setPhotoError(null);
        }}
      />

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (busy || reading.current || !canSubmit) return;
          if (mode === "url") onSubmit({ url });
          else if (mode === "text") onSubmit({ text });
          else if (selected.current) onSubmit({ imageBase64: selected.current.base64, imageMediaType: selected.current.mediaType });
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

      {preparing ? <p className={styles.sourceHint} role="status">Reading your selected photo…</p> : null}
      {photoError ? <Callout tone="error" role="alert">{photoError}</Callout> : null}
      {hint && !busy ? <p className={styles.sourceHint}>{hint}</p> : null}
    </>
  );
}
