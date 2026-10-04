import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState, Linking, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@clerk/expo";
import * as Crypto from "expo-crypto";
import { parseProductBarcode, type BarcodeProductDraft, type PantryIntakeView } from "@seconds/core/format";
import { createAccountClient } from "@/lib/client";
import { Button, Callout, Field, Panel, PanelHeader, space, usePalette } from "@/ui";

export function BarcodeCapture({ onQueued }: { onQueued: (intake: PantryIntakeView) => void }) {
  const { userId } = useAuth();
  const client = useMemo(() => userId ? createAccountClient(userId) : null, [userId]);
  const owner = useRef(userId); owner.current = userId;
  const version = useRef(0);
  const c = usePalette();
  const [permission, requestPermission] = useCameraPermissions();
  const [camera, setCamera] = useState(false);
  const scannerLock = useRef(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [availabilityError, setAvailabilityError] = useState(false);
  const [availabilityVisit, setAvailabilityVisit] = useState(0);
  const [uncertain, setUncertain] = useState(false);
  const action = useRef(false);
  const cameraRun = useRef(0);
  const [barcode, setBarcode] = useState("");
  const [product, setProduct] = useState<BarcodeProductDraft | null>(null);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState("packages");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reference = useRef<string | null>(null);
  useEffect(() => {
    if (!camera) return;
    const timer = setTimeout(() => { ++cameraRun.current; scannerLock.current = true; setCamera(false); setNotice("Scanning paused. Try again or enter the product by hand."); }, 45000);
    return () => clearTimeout(timer);
  }, [camera]);
  useFocusEffect(useCallback(() => () => { ++cameraRun.current; setCamera(false); scannerLock.current = true; }, []));
  useEffect(() => {
    const listener = AppState.addEventListener("change", state => { if (state !== "active") { ++cameraRun.current; setCamera(false); scannerLock.current = true; } });
    return () => listener.remove();
  }, []);
  useEffect(() => {
    ++version.current; ++cameraRun.current;
    action.current = false; setUncertain(false); setAvailabilityError(false);
    setCamera(false); setProduct(null); setName(""); setAmount(""); setBarcode(""); setError(null); setNotice(null); setBusy(false); setEnabled(null); reference.current = null;
    return () => { ++version.current; ++cameraRun.current; };
  }, [client]);
  useFocusEffect(useCallback(() => {
    let active = true; setEnabled(null); setAvailabilityError(false);
    if (client) void client.barcodeLookupStatus().then(result => { if (active) setEnabled(result.enabled); })
      .catch(() => { if (active) setAvailabilityError(true); });
    else setEnabled(false);
    return () => { active = false; };
  }, [client, availabilityVisit]));
  const lookup = async (value = barcode) => {
    if (action.current || uncertain) return;
    if (!client) { setError("Sign in to look up products."); return; }
    action.current = true; ++cameraRun.current;
    const account = owner.current; const run = ++version.current;
    setError(null); setNotice(null); setBusy(true); setCamera(false);
    try {
      const code = parseProductBarcode(value); setBarcode(code);
      const { product: result } = await client.lookupProductBarcode(code);
      if (owner.current !== account || run !== version.current) return;
      setProduct(result); setName(result?.displayName ?? ""); setAmount(""); reference.current = null;
      if (!result) setNotice("No label was found. Enter the product name below.");
    } catch (cause) {
      if (owner.current === account && run === version.current) setError(cause instanceof Error ? cause.message : "Lookup unavailable. Enter the item by hand.");
    } finally { if (owner.current === account && run === version.current) { action.current = false; setBusy(false); } }
  };
  const startCamera = async () => {
    if (action.current || uncertain) return;
    const run = ++cameraRun.current; const account = owner.current;
    setError(null);
    try {
      const result = permission?.granted ? permission : await requestPermission();
      if (run !== cameraRun.current || owner.current !== account || AppState.currentState !== "active") return;
      if (!result.granted) { setError("Camera access was not granted. You can type the barcode or name instead."); return; }
      scannerLock.current = false; setCamera(true);
    } catch { if (run === cameraRun.current && owner.current === account) setError("Camera unavailable. Type the barcode or product name instead."); }
  };
  const queue = async () => {
    if (action.current) return;
    if (!client) { setError("Sign in to save a pantry review."); return; }
    const quantity = amount.trim() ? Number(amount) : null;
    if (!name.trim() || (quantity !== null && (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000))) {
      setError("Enter a name and positive quantity, or leave quantity unknown."); return;
    }
    const account = owner.current; const run = ++version.current;
    action.current = true; ++cameraRun.current; setCamera(false);
    setBusy(true); setError(null); setNotice(null);
    try {
      reference.current ??= Crypto.randomUUID();
      const intake = await client.createPantryIntake({ source: "barcode", externalReference: reference.current, sourceLabel: "Product entered for review", acquiredAt: null,
        items: [{ displayName: name.trim(), quantity, unit: quantity === null ? null : unit.trim() || null }] });
      if (owner.current !== account || run !== version.current) return;
      setUncertain(false); onQueued(intake); setNotice("Item ready for review below. Nothing has entered your pantry yet.");
      setProduct(null); setName(""); setAmount(""); setBarcode(""); reference.current = null;
    } catch {
      if (owner.current === account && run === version.current) { setUncertain(true); setError("We could not confirm the review saved. Your entry is kept unchanged for a safe retry. Check existing reviews below first."); }
    } finally { if (owner.current === account && run === version.current) { action.current = false; setBusy(false); } }
  };
  return <Panel>
    <PanelHeader title="Add a packaged item" hint="Scan its barcode or type the label. You confirm the quantity and review it before inventory changes." />
    <View style={styles.fields}>
      <Text style={{ color: c.text }}>Product barcode</Text>
      <Field accessibilityLabel="Product barcode" keyboardType="number-pad" value={barcode} maxLength={14} editable={!busy && !uncertain} onChangeText={setBarcode} />
      <View style={styles.actions}>
        <Button label="Scan barcode" disabled={busy || uncertain || camera} onPress={() => void startCamera()} />
        <Button label={busy ? "Working…" : "Look up label"} variant="ghost" disabled={busy || uncertain || !enabled} onPress={() => void lookup()} />
      </View>
      {camera ? <View>
        <CameraView style={styles.camera} facing="back" barcodeScannerSettings={{ barcodeTypes: ["ean8", "ean13", "upc_a", "upc_e", "itf14"] }}
          onMountError={() => { setCamera(false); setError("Camera could not open. Enter the barcode by hand."); }}
          onBarcodeScanned={event => {
            if (scannerLock.current) return;
            scannerLock.current = true;
            // UPC-E has eight digits but is not a GTIN-8. Ask for full UPC-A
            // instead of interpreting compressed codes as a different product.
            if (event.type === "upc_e") { setCamera(false); setError("Enter the full 12-digit product code printed on the package."); return; }
            try { const code = parseProductBarcode(event.data); setBarcode(code); setCamera(false); setNotice("Barcode found. Choose Look up label, or enter the product name below."); }
            catch { setCamera(false); setError("This code was not a valid product barcode. Enter the full digits by hand."); }
          }} />
        <Button label="Close camera" variant="ghost" onPress={() => { ++cameraRun.current; scannerLock.current = true; setCamera(false); }} />
      </View> : null}
      {enabled === false ? <Text style={{ color: c.textMuted }}>Lookup is unavailable in this build. Enter the product below.</Text> : null}
      {enabled === null && !availabilityError ? <Text accessibilityLiveRegion="polite" style={{ color: c.textMuted }}>Checking lookup availability… Manual entry is ready below.</Text> : null}
      {availabilityError ? <View style={styles.fields}><Callout tone="info">Could not check lookup availability. Your entry is still here and manual entry works.</Callout>
        <Button label="Check lookup availability again" variant="ghost" onPress={() => setAvailabilityVisit(value => value + 1)} />
      </View> : null}
      {product ? <View><Text style={{ color: c.textMuted }}>{product.brand ?? ""} {product.packageLabel ? `Package label: ${product.packageLabel}.` : ""} Open Food Facts data (ODbL) can be incomplete. Check your package for allergens.</Text>
        <Button label="View Open Food Facts source" variant="ghost" onPress={() => void Linking.openURL(product.sourceUrl).catch(() => setError("Could not open the source link."))} /></View> : null}
      <Text style={{ color: c.text }}>Product name, editable</Text>
      <Field accessibilityLabel="Product name, editable" value={name} maxLength={120} editable={!busy && !uncertain} onChangeText={value => { setName(value); reference.current = null; }} />
      <Text style={{ color: c.text }}>Quantity you currently have (optional)</Text>
      <Field accessibilityLabel="Quantity you currently have, optional" keyboardType="decimal-pad" value={amount} editable={!busy && !uncertain} onChangeText={value => { setAmount(value); reference.current = null; }} />
      <Field accessibilityLabel="Quantity unit" value={unit} maxLength={40} editable={!busy && !uncertain} onChangeText={value => { setUnit(value); reference.current = null; }} />
      <Text style={{ color: c.textMuted }}>Package size is not the number purchased. Leave quantity blank if unsure. Accepting replaces a matching pantry entry rather than adding to its old quantity.</Text>
      <Button label={uncertain ? "Retry the same pantry review" : "Queue item for pantry review"} disabled={busy || !name.trim()} onPress={() => void queue()} />
      {uncertain ? <Button label="Discard local entry" variant="ghost" disabled={busy} onPress={() => Alert.alert("Discard local entry?", "The earlier review may already have saved. Check reviews before adding it again.", [
        { text: "Keep entry", style: "cancel" }, { text: "Discard local entry", style: "destructive", onPress: () => {
          if (action.current) return;
          setUncertain(false); setName(""); setAmount(""); setBarcode(""); setProduct(null); setError(null); reference.current = null;
        } },
      ])} /> : null}
      {notice ? <Callout tone="info">{notice}</Callout> : null}
      {error ? <Callout tone="error">{error}</Callout> : null}
    </View>
  </Panel>;
}
const styles = StyleSheet.create({ fields: { gap: space.sm }, actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm }, camera: { height: 260, width: "100%" } });
