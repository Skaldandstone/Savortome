import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { File, Paths } from "expo-file-system";
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from "expo-audio";
import { ApiError, isPhotoMediaType, type FoodNoteDraft, type SecondsClient } from "@seconds/core/format";
import { Button, Callout, Panel, PanelHeader, space, usePalette } from "@/ui";
class CaptureInputError extends Error {}
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
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const audioRef = useRef<string | null>(null);
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
  const stop = useCallback((keep: boolean): Promise<void> => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    if (stopping.current) {
      if (keep) return stopping.current;
      keepStopped.current = false;
      removeTemporaryFile(audioRef.current); audioRef.current = null;
      if (active.current) setAudioUri(null);
      // Discard can arrive after the stop saved its URI but before audio-mode
      // restoration finishes. Clean up again once that same stop settles.
      return stopping.current.then(() => { removeTemporaryFile(recorder.uri); });
    }
    keepStopped.current = keep;
    const version = generation.current;
    const work = async () => { try {
      if (recordingRef.current) { recordingRef.current = false; await recorder.stop(); }
      const uri = recorder.uri ?? audioRef.current;
      if (keepStopped.current && active.current && generation.current === version && uri) {
        audioRef.current = uri; setAudioUri(uri);
      } else { removeTemporaryFile(uri); removeTemporaryFile(audioRef.current); audioRef.current = null; if (active.current) setAudioUri(null); }
    } catch {
      keepStopped.current = false; removeTemporaryFile(recorder.uri); removeTemporaryFile(audioRef.current); audioRef.current = null;
      if (active.current) { setAudioUri(null); setError("Recording could not be finalized. It will not be offered for sending. You can type a note instead."); }
    }
    finally {
      // Restore playback mode; this feature never requests background audio.
      await setAudioModeAsync({ allowsRecording: false, shouldPlayInBackground: false }).catch(() => {});
      if (active.current && !recordingRef.current) { setRecording(false); onBusy(false); }
      stopping.current = null;
    } };
    stopping.current = work(); return stopping.current;
  }, [recorder, onBusy]);
  useFocusEffect(useCallback(() => {
    active.current = true;
    operation.current = false;
    setBusy(false); setRecording(false); setAudioUri(null); onBusy(false);
    return () => { active.current = false; ++generation.current; void stop(false); removeTemporaryFile(audioRef.current); audioRef.current = null; };
  }, [stop, onBusy]));
  useEffect(() => {
    const listener = AppState.addEventListener("change", state => {
      // System photo pickers and permission sheets may change AppState. Do not
      // invalidate a photo selection simply because its picker became active.
      if (state !== "active" && (recordingRef.current || audioRef.current || stopping.current)) {
        ++generation.current; operation.current = false; setBusy(false); onBusy(false); void stop(false);
      }
    });
    return () => listener.remove();
  }, [stop, onBusy]);
  const loadStatus = useCallback(async () => {
    const version = generation.current; const request = ++statusRequest.current;
    setStatus(null); setStatusError(false);
    try { const result = await client.foodNoteCaptureStatus(); if (active.current && version === generation.current && request === statusRequest.current) setStatus(result); }
    catch { if (active.current && version === generation.current && request === statusRequest.current) setStatusError(true); }
  }, [client]);
  useFocusEffect(useCallback(() => { void loadStatus(); return () => { ++statusRequest.current; }; }, [loadStatus]));
  const draft = async (source: "photo" | "voice", base64: string, mediaType: string, version: number) => {
    const result = await client.foodNoteDraft(source, base64, mediaType);
    if (active.current && generation.current === version) onDraft(result.draft, source);
  };
  const photo = async (camera: boolean) => {
    if (operation.current || stopping.current || disabled || recordingRef.current) return;
    operation.current = true;
    const version = generation.current;
    setBusy(true); onBusy(true); setError(null);
    let temporary: string | null = null;
    try {
      if (!await confirmReplace() || !active.current || generation.current !== version) return;
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) throw new CaptureInputError("Camera access was not granted. Choose an existing photo or type a note.");
      }
      if (!active.current || generation.current !== version) return;
      const asset = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7, base64: true })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7, base64: true });
      if (asset.canceled) return;
      const selected = asset.assets[0];
      // ImagePicker returns an app-cache copy, never delete the user's original library asset.
      if (selected?.uri.startsWith(Paths.cache.uri)) temporary = selected.uri;
      if (!active.current || generation.current !== version) return;
      const type = selected?.mimeType ?? (selected?.uri.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");
      if (!selected?.base64 || selected.base64.length > 10_666_668 || !isPhotoMediaType(type)) throw new CaptureInputError("Use a JPEG, PNG or WebP photo under 8 MB.");
      await draft("photo", selected.base64, type, version);
    } catch (cause) { if (active.current && generation.current === version) setError(captureFailure(cause, "Could not prepare a photo draft. Type a note instead.")); }
    finally { removeTemporaryFile(temporary); if (active.current && generation.current === version) { operation.current = false; setBusy(false); onBusy(false); } }
  };
  const start = async () => {
    if (operation.current || stopping.current || disabled || recordingRef.current) return;
    operation.current = true;
    const version = generation.current;
    setError(null); removeTemporaryFile(audioRef.current); audioRef.current = null; setAudioUri(null); setBusy(true); onBusy(true);
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) throw new CaptureInputError("Microphone access was not granted. You can type a note or use keyboard dictation.");
      if (!active.current || generation.current !== version || AppState.currentState !== "active") return;
      await setAudioModeAsync({ allowsRecording: true, shouldPlayInBackground: false });
      await recorder.prepareToRecordAsync();
      if (!active.current || generation.current !== version || AppState.currentState !== "active") { await stop(false); return; }
      recordingRef.current = true; recorder.record(); setRecording(true);
      timer.current = setTimeout(() => { void stop(true); }, 45_000);
    } catch (cause) {
      // Preparation/record() can fail after recording mode was enabled. Restore
      // playback and discard any partial cache file before exposing recovery.
      await stop(false);
      if (active.current && generation.current === version) setError(captureFailure(cause, "Recording unavailable. Type a note instead."));
    }
    finally { if (active.current && generation.current === version) { operation.current = false; setBusy(false); if (!recordingRef.current) onBusy(false); } }
  };
  const sendVoice = async () => {
    if (operation.current || stopping.current || disabled || recordingRef.current) return;
    operation.current = true;
    const version = generation.current; const uri = audioRef.current;
    setBusy(true); onBusy(true); setError(null);
    let sent = false;
    try {
      if (!uri || !await confirmReplace() || !active.current || generation.current !== version) return;
      const file = new File(uri);
      if (!file.exists || file.size === 0 || file.size > 5_000_000) throw new CaptureInputError("Recording is empty or too large. Try a shorter note.");
      const base64 = await file.base64();
      if (!active.current || generation.current !== version) return;
      sent = true;
      await draft("voice", base64, "audio/mp4", version);
    } catch (cause) { if (active.current && generation.current === version) setError(captureFailure(cause, "Voice draft unavailable. Type a note instead.")); }
    finally {
      if (sent) { removeTemporaryFile(uri); if (audioRef.current === uri) audioRef.current = null; }
      if (active.current && generation.current === version) { operation.current = false; if (sent) setAudioUri(null); setBusy(false); onBusy(false); }
    }
  };
  return <Panel>
    <Button label={expanded ? "Hide photo and voice options" : "Use an optional photo or voice note"} variant="ghost" disabled={busy || recording} onPress={() => setExpanded(current => !current)} />
    {expanded ? <View style={styles.options}>
      <PanelHeader title="Make an editable draft" hint="Only when you send a file does it go to OpenAI. Savortome does not save the original file or raw transcript as a food note. Provider processing and retention follow the configured OpenAI service." />
      <Text style={{ color: c.textMuted }}>A photo cannot establish hidden ingredients, portions, nutrients or allergy safety. Review every suggestion. Text entry always works without AI.</Text>
      {!status && !statusError ? <Text style={{ color: c.textMuted }}>Checking capture availability…</Text> : null}
      {statusError ? <Callout tone="error">Capture availability could not load. Type a note or try again.</Callout> : null}
      {statusError ? <Button label="Check capture availability again" variant="ghost" onPress={() => void loadStatus()} /> : null}
      {status?.photo ? <View style={styles.row}>
        <Button label="Take and send food photo" disabled={disabled || busy || recording} onPress={() => void photo(true)} />
        <Button label="Choose and send food photo" variant="ghost" disabled={disabled || busy || recording} onPress={() => void photo(false)} />
      </View> : status ? <Text style={{ color: c.textMuted }}>Photo suggestions are not enabled in this build.</Text> : null}
      {status?.voice ? <View style={styles.options}>
        <Text style={{ color: c.textMuted }}>Record up to 45 seconds. Recording stops and is discarded when you leave the screen or hide the app. You choose whether to send it for an editable draft.</Text>
        <Button label={recording ? "Stop recording" : "Record a voice note"} disabled={busy || (disabled && !recording)} onPress={() => recording ? void stop(true) : void start()} />
        {recording ? <Text accessibilityLiveRegion="polite" style={{ color: c.text }}>Recording. Stop whenever you want.</Text> : null}
        {audioUri ? <View style={styles.row}>
          <Button label="Send recording for editable draft" disabled={disabled || busy} onPress={() => void sendVoice()} />
          <Button label="Discard recording" variant="ghost" disabled={busy} onPress={() => { removeTemporaryFile(audioRef.current); audioRef.current = null; setAudioUri(null); }} />
        </View> : null}
      </View> : status ? <Text style={{ color: c.textMuted }}>Voice transcription is not enabled in this build. Your keyboard's dictation can enter text.</Text> : null}
      {error ? <Callout tone="error">{error}</Callout> : null}
    </View> : null}
  </Panel>;
}
const styles = StyleSheet.create({ options: { gap: space.md, marginTop: space.md }, row: { flexDirection: "row", flexWrap: "wrap", gap: space.sm } });
