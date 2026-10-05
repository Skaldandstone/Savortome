import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAuth } from "@clerk/expo";
import * as ImagePicker from "expo-image-picker";
import { isPhotoMediaType, type PhotoMediaType } from "@seconds/core/format";
import { api } from "@/lib/client";
import { Button, Callout, Panel, PanelHeader, space, type as typeScale, usePalette } from "@/ui";

function mediaTypeForAsset(asset: ImagePicker.ImagePickerAsset): PhotoMediaType | null {
  if (isPhotoMediaType(asset.mimeType)) return asset.mimeType;
  const path = `${asset.fileName ?? ""} ${asset.uri}`.toLowerCase();
  if (/\.jpe?g(?:\?|\s|$)/.test(path)) return "image/jpeg";
  if (/\.png(?:\?|\s|$)/.test(path)) return "image/png";
  if (/\.webp(?:\?|\s|$)/.test(path)) return "image/webp";
  return null;
}

export function ReceiptCapture({ onScan }: {
  onScan: (imageBase64: string, imageMediaType: PhotoMediaType) => Promise<boolean>;
}) {
  const { userId, sessionId } = useAuth();
  const c = usePalette();
  const [availability, setAvailability] = useState<"loading" | "enabled" | "disabled" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scope = useMemo(() => ({}), [userId, sessionId]);
  const activeScope = useRef(scope); activeScope.current = scope;
  const dataScope = useRef(scope);
  const mounted = useRef(true);
  const action = useRef(false);
  const current = () => mounted.current && activeScope.current === scope;
  useEffect(() => {
    mounted.current = true; dataScope.current = scope; action.current = false;
    setBusy(false); setMessage(null); setError(null);
    return () => { mounted.current = false; };
  }, [scope]);

  useEffect(() => {
    let cancelled = false;
    setAvailability("loading");
    const timeout = setTimeout(() => {
      if (!cancelled && current()) {
        cancelled = true;
        setAvailability("failed");
      }
    }, 12_000);
    void api.receiptScanStatus()
      .then(result => { if (!cancelled && current()) setAvailability(result.enabled ? "enabled" : "disabled"); })
      .catch(() => { if (!cancelled && current()) setAvailability("failed"); })
      .finally(() => clearTimeout(timeout));
    return () => { cancelled = true; clearTimeout(timeout); };
  }, [attempt, scope]);

  const scan = async (source: "camera" | "library") => {
    if (!current() || action.current || availability !== "enabled") return;
    action.current = true;
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      if (source === "camera") {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!current()) return;
        if (!permission.granted) {
          setError("Camera access was not granted. You can choose an existing receipt photo instead.");
          return;
        }
      }
      const result = source === "camera"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], base64: true, quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], base64: true, quality: 0.8 });
      if (!current() || result.canceled) return;
      const asset = result.assets[0];
      const mediaType = asset ? mediaTypeForAsset(asset) : null;
      if (!asset?.base64 || !mediaType) {
        setError("Use a JPEG, PNG, or WebP receipt photo.");
        return;
      }
      const saved = await onScan(asset.base64, mediaType);
      if (!current()) return;
      if (saved) {
        setMessage("Receipt ready to review below. Nothing was added to your pantry yet.");
      } else {
        setError("The receipt was not saved for review. Check your connection and account, then try again. Nothing was added to your pantry.");
      }
    } catch {
      if (current()) setError("That receipt could not be read. Try again, or choose an existing receipt photo. Nothing was added to your pantry.");
    } finally {
      if (current()) { action.current = false; setBusy(false); }
    }
  };

  if (dataScope.current !== scope) return <Text accessibilityLiveRegion="polite">Checking receipt scanning for your sign-in�</Text>;
  return (
    <Panel>
      <PanelHeader
        title="Scan a grocery receipt"
        hint="We read food names, then discard the photo. You review every item before it enters your pantry."
      />
      {availability === "enabled" ? (
        <View style={styles.actions}>
          <Button label={busy ? "Reading receipt…" : "Take receipt photo"} disabled={busy} onPress={() => void scan("camera")} />
          <Button label="Choose receipt photo" variant="ghost" disabled={busy} onPress={() => void scan("library")} />
        </View>
      ) : availability === "loading" ? (
        <Text accessibilityLiveRegion="polite" style={[styles.unavailable, { color: c.textMuted }]}>Checking receipt scanning… You can still add pantry items by hand.</Text>
      ) : availability === "failed" ? (
        <>
          <Callout tone="error" title="Could not check receipt scanning">Check your connection and account, then try again. Your pantry has not changed.</Callout>
          <Button label="Try receipt scanning again" variant="ghost" onPress={() => { if (current()) setAttempt(value => value + 1); }} />
        </>
      ) : (
        <Text style={[styles.unavailable, { color: c.textMuted }]}>Receipt scanning is currently unavailable. You can still add pantry items by hand.</Text>
      )}
      {message ? <Callout tone="info">{message}</Callout> : null}
      {error ? <Callout tone="error" title="Receipt not scanned">{error}</Callout> : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  unavailable: { fontSize: typeScale.small, lineHeight: 20 },
});
