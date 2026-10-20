import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Image, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { File, Paths } from "expo-file-system";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from "expo-audio";
import { ApiError, isPhotoMediaType, type FoodNoteDraft, type SecondsClient } from "@seconds/core/format";
import { Button, Callout, Panel, PanelHeader, space, usePalette } from "@/ui";
class CaptureInputError extends Error {}
type SelectedPhoto = { client: SecondsClient; base64: string; mediaType: string; temporaryUri: string | null; previewUri: string | null };
type SelectedVoice = { client: SecondsClient; uri: string };
function captureFailure(cause: unknown, fallback: string) {
  if (cause instanceof CaptureInputError) return cause.message;
  if (cause instanceof ApiError && cause.status === 401) return "Your sign-in may have ended. Sign in again before sending a food note.";
  if (cause instanceof ApiError && cause.status === 408) return "The request timed out. Nothing was saved as a food note. You can type a note instead.";
  // Native SDK/file/provider diagnostics may contain paths or raw details.
  return fallback;
}

function removeTemporaryFile(uri: string | null) {
  if (!uri) return;
  try {
    const candidate = new URL(uri); const cache = new URL(Paths.cache.uri);
    const root = cache.pathname.endsWith("/") ? cache.pathname : `${cache.pathname}/`;
    // Do not accept a sibling prefix, encoded separators or traversal path.
    if (candidate.protocol !== "file:" || cache.protocol !== "file:" || candidate.hostname !== cache.hostname || !candidate.pathname.startsWith(root) || /%(?:2f|5c|00)/i.test(candidate.pathname) || candidate.search || candidate.hash) return;
    const file = new File(candidate.href); if (file.exists) file.delete();
  } catch { /* Never log media paths or delete outside our cache. */ }
}

export function FoodNoteCapture({ client, onDraft, onBusy, confirmReplace, disabled = false }: {
  client: SecondsClient;
  onDraft: (draft: FoodNoteDraft, source: "photo" | "voice") => void;
  onBusy: (busy: boolean) => void;
  confirmReplace: () => Promise<boolean>;
  disabled?: boolean;
}) {
  const c = usePalette();
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<{ photo: boolean; voice: boolean } | null>(null);
  const [statusError, setStatusError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceClip, setVoiceClip] = useState<SelectedVoice | null>(null);
  const audioRef = useRef<SelectedVoice | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<SelectedPhoto | null>(null);
  const [photoSending, setPhotoSending] = useState(false);
  const photoRef = useRef<SelectedPhoto | null>(null);
  const currentScope = useRef({ client, disabled });
  currentScope.current = { client, disabled };
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const active = useRef(false);
  const statusRequest = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingRef = useRef(false);
  const operation = useRef(false);
  const stopping = useRef<Promise<void> | null>(null);
  const keepStopped = useRef(false);
  const recorder = useAudioRecorder({ ...RecordingPresets.HIGH_QUALITY, directory: "cache" });
  const discardPhoto = useCallback(() => {
    removeTemporaryFile(photoRef.current?.temporaryUri ?? null);
    photoRef.current = null;
    if (active.current) { setSelectedPhoto(null); setPhotoSending(false); }
  }, []);
  const discardVoice = useCallback(() => {
    removeTemporaryFile(audioRef.current?.uri ?? null);
    audioRef.current = null;
    if (active.current) setVoiceClip(null);
  }, []);
  const stop = useCallback((keep: boolean): Promise<void> => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (stopping.current) {
      if (keep) return stopping.current;
      keepStopped.current = false;
      discardVoice();
      // Discard can arrive after the stop saved its URI but before audio-mode
      // restoration finishes. Clean up again once that same stop settles.
      return stopping.current.then(() => { removeTemporaryFile(recorder.uri); });
    }
    keepStopped.current = keep;
    const version = generation.current;
    const work = async () => { try {
      if (recordingRef.current) { recordingRef.current = false; await recorder.stop(); }
      const uri = recorder.uri ?? audioRef.current?.uri;
      if (keepStopped.current && active.current && generation.current === version && currentScope.current.client === client && !currentScope.current.disabled && uri) {
        const clip = { client, uri }; audioRef.current = clip; setVoiceClip(clip);
      } else { removeTemporaryFile(uri ?? null); discardVoice(); }
    } catch {
      keepStopped.current = false; removeTemporaryFile(recorder.uri); discardVoice();
      if (active.current) { setVoiceClip(null); setError("Recording could not be finalized. It will not be offered for sending. You can type a note instead."); }
    }
    finally {
      // Restore playback mode; this feature never requests background audio.
      await setAudioModeAsync({ allowsRecording: false, shouldPlayInBackground: false }).catch(() => {});
      if (active.current && currentScope.current.client === client && !recordingRef.current) { setRecording(false); onBusy(false); }
      stopping.current = null;
    } };
    stopping.current = work(); return stopping.current;
  }, [client, recorder, onBusy, discardVoice]);
  useFocusEffect(useCallback(() => {
    active.current = true;
    operation.current = false;
    setBusy(false); setRecording(false); setVoiceClip(null); setSelectedPhoto(null); setPhotoSending(false); onBusy(false);
    return () => { active.current = false; ++generation.current; discardPhoto(); void stop(false); discardVoice(); };
  }, [client, stop, onBusy, discardPhoto, discardVoice]));
  useEffect(() => {
    const listener = AppState.addEventListener("change", state => {
      // System photo pickers and permission sheets may change AppState. Do not
      // invalidate a photo selection simply because its picker became active.
      if (state !== "active" && (photoRef.current || recordingRef.current || audioRef.current || stopping.current)) {
        ++generation.current; operation.current = false; discardPhoto(); setBusy(false); onBusy(false); void stop(false);
      }
    });
    return () => listener.remove();
  }, [stop, onBusy, discardPhoto]);
  const loadStatus = useCallback(async () => {
    const version = generation.current; const request = ++statusRequest.current;
    setStatus(null); setStatusError(false);
    try { const result = await client.foodNoteCaptureStatus(); if (active.current && version === generation.current && request === statusRequest.current) setStatus(result); }
    catch { if (active.current && version === generation.current && request === statusRequest.current) setStatusError(true); }
  }, [client]);
  useFocusEffect(useCallback(() => { void loadStatus(); return () => { ++statusRequest.current; }; }, [loadStatus]));
  const draft = async (source: "photo" | "voice", base64: string, mediaType: string, version: number) => {
    if (!active.current || generation.current !== version || currentScope.current.client !== client || currentScope.current.disabled) return;
    const result = await client.foodNoteDraft(source, base64, mediaType);
    if (active.current && generation.current === version && currentScope.current.client === client && !currentScope.current.disabled) onDraft(result.draft, source);
  };
  const photo = async (camera: boolean) => {
    if (!active.current || operation.current || stopping.current || currentScope.current.disabled || currentScope.current.client !== client || recordingRef.current) return;
    operation.current = true;
    const version = generation.current;
    const current = () => active.current && generation.current === version && currentScope.current.client === client && !currentScope.current.disabled;
    discardPhoto();
    setBusy(true); onBusy(true); setError(null);
    let temporary: string | null = null;
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) throw new CaptureInputError("Camera access was not granted. Choose an existing photo or type a note.");
      }
      if (!current()) return;
      const asset = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7, base64: true })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, base64: true });
      if (asset.canceled) return;
      const selected = asset.assets[0];
      // ImagePicker returns an app-cache copy, never delete the user's original library asset.
      if (selected?.uri.startsWith(Paths.cache.uri)) temporary = selected.uri;
      if (!current()) return;
      const type = selected?.mimeType ?? (selected?.uri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
      if (!selected?.base64 || selected.base64.length > 10_666_668 || !isPhotoMediaType(type)) throw new CaptureInputError("Use a JPEG, PNG or WebP photo under 8 MB.");
      const chosen = { client, base64: selected.base64, mediaType: type, temporaryUri: temporary,
        previewUri: /^(?:file|content):/i.test(selected.uri) ? selected.uri : null };
      photoRef.current = chosen; setSelectedPhoto(chosen);
      temporary = null; // The staged selection now owns this cache copy.
    } catch (cause) { if (current()) setError(captureFailure(cause, "Could not prepare a photo draft. Type a note instead.")); }
    finally { removeTemporaryFile(temporary); if (active.current && generation.current === version && currentScope.current.client === client) { operation.current = false; setBusy(false); onBusy(false); } }
  };
  const sendPhoto = async () => {
    const chosen = selectedPhoto;
    if (!active.current || !chosen || chosen.client !== client || photoRef.current !== chosen || operation.current || stopping.current || currentScope.current.disabled || currentScope.current.client !== client || recordingRef.current || AppState.currentState !== "active") return;
    operation.current = true;
    const version = generation.current;
    const current = () => active.current && generation.current === version && currentScope.current.client === client && !currentScope.current.disabled && photoRef.current === chosen;
    setBusy(true); onBusy(true); setError(null);
    let sent = false;
    try {
      if (!await confirmReplace() || !current() || AppState.currentState !== "active") return;
      sent = true; setPhotoSending(true);
      await draft("photo", chosen.base64, chosen.mediaType, version);
    } catch (cause) { if (current()) setError(captureFailure(cause, "Photo draft unavailable. Type a note instead.")); }
    finally {
      // A dispatched request is never offered for automatic retry. A new photo
      // requires another deliberate selection and send, even after failure.
      // Leaving/replacement already releases the old selection. A late request
      // must not delete a newer SDK file that happens to reuse its cache path.
      if (sent && photoRef.current === chosen) discardPhoto();
      if (active.current && generation.current === version && currentScope.current.client === client) { operation.current = false; setPhotoSending(false); setBusy(false); onBusy(false); }
    }
  };
  const start = async () => {
    if (!active.current || operation.current || stopping.current || currentScope.current.client !== client || currentScope.current.disabled || recordingRef.current || AppState.currentState !== "active") return;
    operation.current = true;
    const version = generation.current;
    const current = () => active.current && generation.current === version && currentScope.current.client === client && !currentScope.current.disabled && AppState.currentState === "active";
    setError(null); discardVoice(); setBusy(true); onBusy(true);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) throw new CaptureInputError("Microphone access was not granted. You can type a note or use keyboard dictation.");
      if (!current()) return;
      await setAudioModeAsync({ allowsRecording: true, shouldPlayInBackground: false });
      if (!current()) { await stop(false); return; }
      await recorder.prepareToRecordAsync();
      if (!current()) { await stop(false); return; }
      recordingRef.current = true; recorder.record(); setRecording(true);
      timer.current = setTimeout(() => { void stop(true); }, 45_000);
    } catch (cause) {
      // Preparation/record() can fail after recording mode was enabled. Restore
      // playback and discard any partial cache file before exposing recovery.
      await stop(false);
      if (current()) setError(captureFailure(cause, "Recording unavailable. Type a note instead."));
    }
    finally { if (active.current && generation.current === version && currentScope.current.client === client) { operation.current = false; setBusy(false); if (!recordingRef.current) onBusy(false); } }
  };
  const sendVoice = async () => {
    const chosen = voiceClip;
    if (!active.current || !chosen || chosen.client !== client || audioRef.current !== chosen || operation.current || stopping.current || currentScope.current.client !== client || currentScope.current.disabled || recordingRef.current || AppState.currentState !== "active") return;
    operation.current = true;
    const version = generation.current;
    const current = () => active.current && generation.current === version && currentScope.current.client === client && !currentScope.current.disabled && audioRef.current === chosen && AppState.currentState === "active";
    setBusy(true); onBusy(true); setError(null);
    let sent = false;
    try {
      if (!await confirmReplace() || !current()) return;
      const file = new File(chosen.uri);
      if (!file.exists || file.size === 0 || file.size > 5_000_000) throw new CaptureInputError("Recording is empty or too large. Try a shorter note.");
      const base64 = await file.base64();
      if (!current()) return;
      sent = true;
      await draft("voice", base64, "audio/mp4", version);
    } catch (cause) { if (current()) setError(captureFailure(cause, "Voice draft unavailable. Type a note instead.")); }
    finally {
      // A URI may be reused by the SDK; only this exact clip owns its cleanup.
      if (sent && audioRef.current === chosen) discardVoice();
      if (active.current && generation.current === version && currentScope.current.client === client) { operation.current = false; setBusy(false); onBusy(false); }
    }
  };
  return <Panel>
    <Button label={expanded ? "Hide photo and voice options" : "Use an optional photo or voice note"} variant="ghost" disabled={busy || recording} onPress={() => { if (expanded) discardPhoto(); setExpanded(current => !current); }} />
    {expanded ? <View style={styles.options}>
      <PanelHeader title="Make an editable draft" hint="Only when you send a file does it go to OpenAI. Savortome does not save the original file or raw transcript as a food note. Provider processing and retention follow the configured OpenAI service." />
      <Text style={{ color: c.textMuted }}>A photo cannot establish hidden ingredients, portions, nutrients or allergy safety. Review every suggestion. Text entry always works without AI.</Text>
      {!status && !statusError ? <Text style={{ color: c.textMuted }}>Checking capture availability…</Text> : null}
      {statusError ? <Callout tone="error">Capture availability could not load. Type a note or try again.</Callout> : null}
      {statusError ? <Button label="Check capture availability again" variant="ghost" onPress={() => void loadStatus()} /> : null}
      {status?.photo ? <View style={styles.row}>
        <Button label="Take a food photo" disabled={disabled || busy || recording} onPress={() => void photo(true)} />
        <Button label="Choose a food photo" variant="ghost" disabled={disabled || busy || recording} onPress={() => void photo(false)} />
      </View> : status ? <Text style={{ color: c.textMuted }}>Photo suggestions are not enabled in this build.</Text> : null}
      {selectedPhoto?.client === client && !disabled ? <View style={styles.options}>
        {selectedPhoto.previewUri ? <Image source={{ uri: selectedPhoto.previewUri }} accessibilityLabel={photoSending ? "Selected food photo" : "Selected food photo, not sent"} resizeMode="contain" style={styles.preview} /> : null}
        <Text accessibilityLiveRegion="polite" style={{ color: c.textMuted }}>{photoSending ? "Photo sent for an editable draft. Nothing has been saved as a food note." : "Photo selected. It has not been sent. Send it only if you want an editable suggestion; nothing is saved as a food note until you review and save."}</Text>
        <Text style={{ color: c.textMuted }}>{photoSending ? "Leaving clears the local preview; it cannot recall a photo already sent." : "This temporary selection is discarded when you leave this screen, hide these options or hide the app."}</Text>
        <View style={styles.row}>
          <Button label="Send photo for editable draft" disabled={disabled || busy || recording} onPress={() => void sendPhoto()} />
          <Button label="Discard photo" variant="ghost" disabled={busy} onPress={discardPhoto} />
        </View>
      </View> : null}
      {status?.voice ? <View style={styles.options}>
        <Text style={{ color: c.textMuted }}>Record up to 45 seconds. Recording stops and is discarded when you leave the screen or hide the app. You choose whether to send it for an editable draft.</Text>
        <Button label={recording ? "Stop recording" : "Record a voice note"} disabled={busy || (disabled && !recording)} onPress={() => recording ? void stop(true) : void start()} />
        {recording ? <Text accessibilityLiveRegion="polite" style={{ color: c.text }}>Recording. Stop whenever you want.</Text> : null}
        {voiceClip?.client === client && !disabled ? <View style={styles.row}>
          <Button label="Send recording for editable draft" disabled={disabled || busy} onPress={() => void sendVoice()} />
          <Button label="Discard recording" variant="ghost" disabled={busy} onPress={() => { if (audioRef.current === voiceClip && currentScope.current.client === client) discardVoice(); }} />
        </View> : null}
      </View> : status ? <Text style={{ color: c.textMuted }}>Voice transcription is not enabled in this build. Your keyboard's dictation can enter text.</Text> : null}
      {error ? <Callout tone="error">{error}</Callout> : null}
    </View> : null}
  </Panel>;
}
const styles = StyleSheet.create({ options: { gap: space.md, marginTop: space.md }, row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm }, preview: { width: "100%", height: 160 } });
