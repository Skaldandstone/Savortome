import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
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
  const c = usePalette();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api.receiptScanStatus()
      .then(result => { if (!cancelled) setEnabled(result.enabled); })
      .catch(() => { if (!cancelled) setEnabled(false); });
    return () => { cancelled = true; };
  }, []);

  if (enabled === null) return null;

  const scan = async (source: "camera" | "library") => {
    setError(null);
    setMessage(null);
    if (source === "camera") {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError("Camera access was not granted. You can choose an existing receipt photo instead.");
        return;
      }
    }

    setBusy(true);
    try {
      const result = source === "camera"
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], base64: true, quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], base64: true, quality: 0.8 });
      if (result.canceled) return;
      const asset = result.assets[0];
      const mediaType = asset ? mediaTypeForAsset(asset) : null;
      if (!asset?.base64 || !mediaType) {
        setError("Use a JPEG, PNG, or WebP receipt photo.");
        return;
      }
      if (await onScan(asset.base64, mediaType)) {
        setMessage("Receipt ready to review below. Nothing was added to your pantry yet.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That receipt could not be read.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel>
      <PanelHeader
        title="Scan a grocery receipt"
        hint="We read food names, then discard the photo. You review every item before it enters your pantry."
      />
      {enabled ? (
        <View style={styles.actions}>
          <Button label={busy ? "Reading receipt…" : "Take receipt photo"} disabled={busy} onPress={() => void scan("camera")} />
          <Button label="Choose receipt photo" variant="ghost" disabled={busy} onPress={() => void scan("library")} />
        </View>
      ) : (
        <Text style={[styles.unavailable, { color: c.textMuted }]}>Receipt scanning is not enabled in this build. You can still add pantry items by hand.</Text>
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
