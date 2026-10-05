"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient, isPhotoMediaType, MAX_PHOTO_BYTES, MAX_RECIPE_PHOTOS, RecipePhotoSchema, type RecipePhoto } from "@seconds/core/format";
import { Button, Callout } from "@/ui";
import { useAuth } from "@clerk/nextjs";
import { compressForUpload, readAsBase64 } from "@/lib/photo";
import styles from "./recipe.module.css";

// A sanity bound before even trying to decode, not the real limit — a modern
// phone photo comfortably clears this; it exists to avoid asking the browser
// to decode something absurd. The real limit is checked after compression,
// below, since that's the number that actually determines what gets sent.
const MAX_PHOTO_BYTES_BEFORE_COMPRESSION = 50_000_000;

/** Your own photos of the finished dish — separate from a source page's own image. */
type Props = { recipeId: string; initial: RecipePhoto[]; clerkEnabled?: boolean };
export function RecipePhotos({ clerkEnabled = true, ...props }: Props) {
  return clerkEnabled ? <AuthenticatedPhotos {...props} /> : <AccountPhotos key={props.recipeId} {...props} />;
}
function AuthenticatedPhotos(props: Props) {
  const { isLoaded, userId, sessionId } = useAuth();
  if (!isLoaded) return <p role="status">Loading sign-in for your photos…</p>;
  if (!userId || !sessionId) return <p role="status">Sign in again to load your saved photos.</p>;
  // Fresh authenticated read, never reuse another session's initial gallery.
  return <AccountPhotos key={`${sessionId}:${props.recipeId}`} {...props} sessionId={sessionId} />;
}
function AccountPhotos({ recipeId, initial, sessionId }: Props & { sessionId?: string }) {
  const api = useMemo(() => createClient({ expectedSessionId: sessionId }), [sessionId]);
  const [photos, setPhotos] = useState(sessionId ? [] : initial);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [loaded, setLoaded] = useState(!sessionId);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const galleryHeading = useRef<HTMLHeadingElement>(null);
  const focusOrigin = useRef<HTMLButtonElement | null>(null);
  const [focusVersion, setFocusVersion] = useState(0);
  const alive = useRef(true);
  const action = useRef(false);
  const pending = useRef(false);
  useEffect(() => { alive.current = true; if (sessionId) void refresh(); return () => { alive.current = false; }; }, []);
  useEffect(() => {
    const origin = focusOrigin.current;
    focusOrigin.current = null;
    if (!alive.current || !origin) return;
    const doc = origin.ownerDocument;
    // A removed/disabled focused button may fall back to body. Never pull
    // focus back if the user already moved to another control while waiting.
    if (doc.activeElement === origin || doc.activeElement === doc.body) galleryHeading.current?.focus();
  }, [focusVersion]);
  function recoverRemovalFocus(origin: HTMLButtonElement | undefined, hadFocus: boolean) {
    if (!origin || !hadFocus || !alive.current) return;
    focusOrigin.current = origin;
    setFocusVersion(version => version + 1);
  }

  function checkedPhotos(value: unknown): RecipePhoto[] {
    if (!Array.isArray(value) || value.length > MAX_RECIPE_PHOTOS) throw new Error("Unconfirmed photos.");
    const entries = value.map(photo => RecipePhotoSchema.parse(photo));
    if (new Set(entries.map(photo => photo.key)).size !== entries.length) throw new Error("Repeated photo reference.");
    return entries;
  }
  async function refresh() {
    if (action.current || !alive.current) return;
    action.current = true; setChecking(true); setError(null); setMessage(null);
    try {
      const recipe = await api.getRecipe(recipeId);
      if (!alive.current) return;
      if (recipe?.id !== recipeId) throw new Error("Unconfirmed recipe.");
      const updated = checkedPhotos(recipe.photos);
      setPhotos(updated); setLoaded(true); setUncertain(false); pending.current = false;
      setMessage("Saved photos refreshed. An earlier request may still finish; review the gallery before adding again.");
    } catch {
      if (alive.current) { setLoaded(false); setError("Couldn't check your saved photos. Sign in if needed, then try checking again. No new upload was started."); }
    } finally { if (alive.current) { action.current = false; setChecking(false); } }
  }

  async function pickPhoto(file: File | undefined) {
    if (action.current || pending.current || !loaded || !alive.current || !file) return;
    setError(null); setMessage(null);
    if (!isPhotoMediaType(file.type)) { setError("That doesn't look like a photo. Try a JPEG, PNG, or WebP."); return; }
    if (file.size > MAX_PHOTO_BYTES_BEFORE_COMPRESSION) { setError("That photo is too large. Try a smaller image."); return; }
    action.current = true; setUploading(true);
    let dispatched = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      // Local preparation is bounded; abandoned work cannot submit an upload.
      const prepared = await Promise.race([
        (async () => { const compressed = await compressForUpload(file); return { compressed, base64: await readAsBase64(compressed) }; })(),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Photo preparation timed out.")), 30_000); }),
      ]);
      if (!alive.current) return;
      if (prepared.compressed.size > MAX_PHOTO_BYTES || !isPhotoMediaType(prepared.compressed.type)) {
        setError("Couldn't prepare that photo within the upload limit. Try a smaller JPEG, PNG, or WebP."); return;
      }
      dispatched = true;
      const result = await api.addRecipePhoto(recipeId, prepared.base64, prepared.compressed.type);
      if (!alive.current) return;
      const updated = checkedPhotos(result?.photos);
      if (!updated.some(photo => !photos.some(existing => existing.key === photo.key))) throw new Error("Upload receipt contains no new photo.");
      setPhotos(updated); setMessage("Photo added to your recipe.");
    } catch (err) {
      if (alive.current) {
        if (dispatched && typeof err === "object" && err !== null && "status" in err && err.status === 501) {
          setError("Photo uploads aren't available right now. No photo was confirmed as added.");
        } else if (dispatched) { pending.current = true; setUncertain(true); setError("Couldn't confirm that photo was added. Check saved photos before choosing it again; the earlier request may still finish."); }
        else setError("Couldn't prepare that photo. Nothing was uploaded; try a smaller photo.");
      }
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      if (alive.current) { action.current = false; setUploading(false); if (fileInput.current) fileInput.current.value = ""; }
    }
  }

  async function remove(key: string, origin?: HTMLButtonElement) {
    if (action.current || pending.current || !loaded || !alive.current) return;
    const hadFocus = !!origin && origin.ownerDocument.activeElement === origin;
    action.current = true; setError(null); setMessage(null); setBusyKey(key);
    try {
      const result = await api.removeRecipePhoto(recipeId, key);
      if (!alive.current) return;
      const updated = checkedPhotos(result?.photos);
      if (updated.some(photo => photo.key === key)) throw new Error("Removal is unconfirmed.");
      setPhotos(updated); setMessage("Photo removed from this recipe. Storage cleanup may still be pending.");
    } catch {
      if (alive.current) { pending.current = true; setUncertain(true); setError("Couldn't confirm the removal. Check saved photos before trying again; no automatic retry was sent."); }
    } finally { if (alive.current) { action.current = false; setBusyKey(null); recoverRemovalFocus(origin, hadFocus); } }
  }

  const busy = uploading || checking || busyKey !== null;
  return (
    <section className={styles.journalPage} aria-label="Your photos" aria-busy={busy} data-print="hide">
      <h3 ref={galleryHeading} tabIndex={-1} className={styles.sectionTitle}>Your photos</h3>
      {!loaded && photos.length === 0 ? <p className={styles.note}>Your saved photos are not confirmed yet. Check them before uploading.</p> : photos.length > 0 ? (
        <ul className={styles.photoGrid}>
          {photos.map((photo) => (
            <li key={photo.key} className={styles.photoTile}>
              {/* eslint-disable-next-line @next/next/no-img-element -- an R2 URL, not a Next-optimized asset */}
              <img src={photo.url} alt="" className={styles.photoImg} />
              <button
                type="button"
                className={styles.photoRemove}
                aria-label={`Remove photo ${photos.indexOf(photo) + 1}`}
                disabled={busy || uncertain || !loaded}
                onClick={(event) => void remove(photo.key, event.currentTarget)}
              >
                {busyKey === photo.key ? "…" : "×"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.note}>No photos yet — add one from your kitchen or your camera roll.</p>
      )}
      {!loaded && photos.length > 0 ? <p className={styles.note}>Last seen photos. We could not confirm the current gallery.</p> : null}
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        aria-label="Add a photo of this dish"
        disabled={busy || uncertain || !loaded}
        onChange={(e) => void pickPhoto(e.target.files?.[0])}
      />
      <Button type="button" disabled={busy} onClick={() => void refresh()}>{checking ? "Checking saved photos…" : uncertain || !loaded ? "Check saved photos" : "Refresh saved photos"}</Button>
      {uploading ? <p className={styles.note} role="status">Preparing or uploading your photo…</p> : null}
      {busyKey !== null ? <p className={styles.note} role="status">Removing your photo…</p> : null}
      {message ? <p className={styles.note} role="status">{message}</p> : null}
      {error ? <Callout tone="error" role="alert">{error}</Callout> : null}
    </section>
  );
}
