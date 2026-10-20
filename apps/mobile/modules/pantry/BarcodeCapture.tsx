import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState, Linking, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@clerk/expo";
import * as Crypto from "expo-crypto";
import { parseProductBarcode, type BarcodeProductDraft, type PantryIntakeInput, type PantryIntakeView } from "@seconds/core/format";
import { createNativePantryRecovery } from "@/lib/nativePantryRecovery";
import type { PantryRecoveryRecord, PantryRecoveryRead } from "@/lib/pantryRecovery";
import { createAccountClient } from "@/lib/client";
import { Button, Callout, Field, Panel, PanelHeader, space, usePalette } from "@/ui";

export function BarcodeCapture({ onQueued }: { onQueued: (intake: PantryIntakeView) => void }) {
  const { userId, sessionId } = useAuth();
  const client = useMemo(() => userId ? createAccountClient(userId) : null, [userId, sessionId]);
  const recovery = useMemo(() => userId && sessionId ? createNativePantryRecovery(userId, sessionId) : null, [userId, sessionId]);
  const activeClient = useRef(client); activeClient.current = client;
  const dataClient = useRef(client);
  const mounted = useRef(true);
  const focused = useRef(true);
  const current = () => mounted.current && activeClient.current === client;
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
  const [copyConsent, setCopyConsentState] = useState(false);
  const copyConsentRef = useRef(false);
  const setCopyConsent = (value: boolean) => { copyConsentRef.current = value; setCopyConsentState(value); };
  const [device, setDevice] = useState<PantryRecoveryRead | { status: "checking" | "blocked" }>({ status: "checking" });
  const deviceRef = useRef(device);
  const updateDevice = (value: typeof device) => { deviceRef.current = value; setDevice(value); };
  const [reviewCopy, setReviewCopy] = useState(false);
  const durable = useRef<PantryRecoveryRecord | null>(null);
  const reference = useRef<string | null>(null);
  // Disabled inputs can still deliver queued events. Hold the submitted body
  // independently until its result is confirmed or that entry is discarded.
  const submitted = useRef<PantryIntakeInput | null>(null);
  const renderedVersion = version.current;
  const renderedSubmission = submitted.current;
  const recoveryAllowsEntry = () => deviceRef.current.status === "empty" || deviceRef.current.status === "expired";
  const editable = () => current() && !action.current && submitted.current === null && recoveryAllowsEntry();
  useEffect(() => {
    if (!camera) return;
    const run = cameraRun.current;
    const timer = setTimeout(() => { if (!current() || run !== cameraRun.current) return; ++cameraRun.current; scannerLock.current = true; setCamera(false); setNotice("Scanning paused. Try again or enter the product by hand."); }, 45000);
    return () => clearTimeout(timer);
  }, [camera, client]);
  useFocusEffect(useCallback(() => { focused.current = true; return () => { focused.current = false; ++cameraRun.current; setCamera(false); scannerLock.current = true; }; }, []));
  useEffect(() => {
    const listener = AppState.addEventListener("change", state => { if (mounted.current && state !== "active") { ++cameraRun.current; setCamera(false); scannerLock.current = true; } });
    return () => listener.remove();
  }, []);
  useEffect(() => {
    mounted.current = true; dataClient.current = client;
    ++version.current; ++cameraRun.current;
    action.current = false; durable.current = null; setCopyConsent(false); setReviewCopy(false); updateDevice({ status: "checking" }); setUncertain(false); setAvailabilityError(false);
    setCamera(false); setProduct(null); setName(""); setAmount(""); setUnit("packages"); setBarcode(""); setError(null); setNotice(null); setBusy(false); setEnabled(null); reference.current = null; submitted.current = null;
    return () => { mounted.current = false; ++version.current; ++cameraRun.current; scannerLock.current = true; };
  }, [client]);
  useFocusEffect(useCallback(() => {
    let active = true; setEnabled(null); setAvailabilityError(false);
    if (client) void client.barcodeLookupStatus().then(result => { if (active && current()) setEnabled(result.enabled); })
      .catch(() => { if (active && current()) setAvailabilityError(true); });
    else setEnabled(false);
    return () => { active = false; };
  }, [client, availabilityVisit]));
  // Access checks expiry and offers recovery; it never restores fields or sends.
  useEffect(() => {
    let live = true;
    if (!recovery) { updateDevice({ status: "blocked" }); return; }
    updateDevice({ status: "checking" }); setReviewCopy(false);
    void recovery.read(true).then(result => {
      if (!live || !current()) return;
      updateDevice(result);
      if (result.status === "expired") setNotice("The expired pantry copy was removed from this device. The earlier review may still have saved. Check existing reviews before entering it again.");
    }).catch(() => { if (live && current()) { updateDevice({ status: "blocked" }); setError("Device recovery could not be checked. No review was sent. Check again or deliberately discard the device copy before adding another entry."); } });
    return () => { live = false; };
  }, [recovery]);
  const inspectCopy = async (resume: boolean) => {
    if (!current() || action.current || !recovery || durable.current) return;
    const offered = deviceRef.current;
    if (resume && (!reviewCopy || offered.status !== "review")) return;
    action.current = true; setBusy(true); setError(null);
    try {
      const result = await recovery.read(true);
      if (!current()) return;
      updateDevice(result);
      if (result.status !== "review") {
        setReviewCopy(false);
        setNotice(result.status === "expired" ? "The expired pantry copy was removed. Check existing reviews before entering it again." : "No recoverable review was confirmed. Nothing was sent.");
        return;
      }
      if (!resume || offered.status !== "review" || JSON.stringify(offered.record) !== JSON.stringify(result.record)) {
        setReviewCopy(true); setNotice("Review this device copy. Nothing has been sent; an earlier request may already have saved."); return;
      }
      const input = result.record.input, item = input.items[0]!;
      ++version.current; ++cameraRun.current; setCamera(false);
      durable.current = result.record; submitted.current = input; reference.current = input.externalReference ?? null;
      setName(item.displayName); setAmount(item.quantity === null ? "" : String(item.quantity)); setUnit(item.unit ?? "packages");
      setProduct(null); setBarcode(""); setUncertain(true); setCopyConsent(true); setReviewCopy(false);
      setNotice("Original review restored for deliberate retry. Check existing reviews first. To edit, discard this local retry; that cannot cancel the earlier request.");
    } catch { if (current()) { updateDevice({ status: "blocked" }); setReviewCopy(false); setError("Device recovery could not be confirmed. Nothing was sent. Check again or discard the local copy."); } }
    finally { if (current()) { action.current = false; setBusy(false); } }
  };
  const discardCopy = () => {
    if (!current() || action.current || !recovery) return;
    const offered = deviceRef.current, pending = submitted.current;
    Alert.alert("Discard pantry recovery?", "This removes only this account's pantry recovery copy and local retry. It cannot cancel an earlier request or remove a saved review. Check existing reviews before entering an edited item.", [
      { text: "Keep recovery", style: "cancel" },
      { text: "Discard pantry recovery", style: "destructive", onPress: () => { void (async () => {
        if (!current() || action.current || deviceRef.current !== offered || submitted.current !== pending) return;
        action.current = true; setBusy(true); setError(null);
        try {
          await recovery.discard(true);
          if (!current()) return;
          ++version.current; durable.current = null; submitted.current = null; reference.current = null;
          setUncertain(false); setReviewCopy(false); setCopyConsent(false); updateDevice({ status: "empty" });
          setName(""); setAmount(""); setUnit("packages"); setBarcode(""); setProduct(null);
          setNotice("Local pantry recovery discarded. An earlier review may still exist or finish saving; check reviews before entering it again.");
        } catch { if (current()) setError("Device-copy removal was not confirmed. Nothing was sent. Your recovery remains blocked; try discard again."); }
        finally { if (current()) { action.current = false; setBusy(false); } }
      })(); } },
    ]);
  };
  const lookup = async (value = barcode) => {
    if (!editable() || uncertain) return;
    if (!client) { setError("Sign in to look up products."); return; }
    action.current = true; ++cameraRun.current;
    const run = ++version.current;
    setError(null); setNotice(null); setBusy(true); setCamera(false);
    try {
      const code = parseProductBarcode(value); setBarcode(code);
      const { product: result } = await client.lookupProductBarcode(code);
      if (!current() || run !== version.current) return;
      setProduct(result); setName(result?.displayName ?? ""); setAmount(""); reference.current = null;
      if (!result) setNotice("No label was found. Enter the product name below.");
    } catch (cause) {
      if (current() && run === version.current) setError(cause instanceof Error ? cause.message : "Lookup unavailable. Enter the item by hand.");
    } finally { if (current() && run === version.current) { action.current = false; setBusy(false); } }
  };
  const startCamera = async () => {
    if (!editable() || uncertain) return;
    if (!focused.current || AppState.currentState !== "active") return;
    const run = ++cameraRun.current;
    setError(null);
    try {
      const result = permission?.granted ? permission : await requestPermission();
      if (run !== cameraRun.current || !current() || !focused.current || AppState.currentState !== "active") return;
      if (!result.granted) { setError("Camera access was not granted. You can type the barcode or name instead."); return; }
      scannerLock.current = false; setCamera(true);
    } catch { if (run === cameraRun.current && current() && focused.current) setError("Camera unavailable. Type the barcode or product name instead."); }
  };
  const queue = async () => {
    if (!current() || action.current || renderedVersion !== version.current || renderedSubmission !== submitted.current) return;
    if (!client || !recovery) { setError("Sign in to save a pantry review."); return; }
    if (!submitted.current && !recoveryAllowsEntry()) return;
    if (!focused.current || AppState.currentState !== "active") return;
    const keepCopy = copyConsentRef.current;
    const quantity = amount.trim() ? Number(amount) : null;
    if (!submitted.current && (!name.trim() || (quantity !== null && (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000)))) {
      setError("Enter a name and positive quantity, or leave quantity unknown."); return;
    }
    const input: PantryIntakeInput = submitted.current ?? { source: "barcode", externalReference: reference.current, sourceLabel: "Product entered for review", acquiredAt: null,
      items: [{ displayName: name.trim(), quantity, unit: quantity === null ? null : unit.trim() || null }] };
    submitted.current = input;
    const run = ++version.current;
    action.current = true; ++cameraRun.current; setCamera(false);
    setBusy(true); setError(null); setNotice(null);
    let sent = false, confirmed = false;
    try {
      reference.current ??= Crypto.randomUUID();
      input.externalReference ??= reference.current;
      if (keepCopy) {
        if (durable.current) {
          const fresh = await recovery.read(true);
          if (!current() || run !== version.current) return;
          if (fresh.status !== "review" || JSON.stringify(fresh.record) !== JSON.stringify(durable.current)) {
            updateDevice(fresh); throw new Error("Recovery changed");
          }
        } else {
          const saved = await recovery.keep(input, true);
          if (!current() || run !== version.current) return;
          durable.current = saved; updateDevice({ status: "review", record: saved });
        }
      }
      if (!current() || run !== version.current) return;
      if (!focused.current || AppState.currentState !== "active") throw new Error("Review left before dispatch");
      sent = true;
      const intake = await client.createPantryIntake(input);
      if (!current() || run !== version.current) return;
      confirmed = true;
      setUncertain(false); onQueued(intake);
      if (keepCopy) {
        await recovery.discard(true, input.externalReference ?? undefined);
        if (!current() || run !== version.current) return;
      }
      durable.current = null; updateDevice({ status: "empty" }); setCopyConsent(false);
      setNotice("Item ready for review below. Nothing has entered your pantry yet.");
      setProduct(null); setName(""); setAmount(""); setBarcode(""); reference.current = null; submitted.current = null;
    } catch {
      if (current() && run === version.current) {
        if (confirmed) {
          durable.current = null; submitted.current = null; reference.current = null;
          setName(""); setAmount(""); setUnit("packages"); setCopyConsent(false); updateDevice({ status: "blocked" });
          setError("The review saved, but device-copy removal was not confirmed. Do not re-enter it. Discard the local copy below; no retry was sent.");
        } else {
          setUncertain(true);
          setError(sent ? "We could not confirm the review saved. Your entry is kept unchanged for a safe retry. Check existing reviews below first." : "The device recovery copy could not be confirmed. This attempt did not send a review. Check recovery or discard the local retry before editing; an earlier request may still have saved.");
        }
      }
    } finally { if (current() && run === version.current) { action.current = false; setBusy(false); } }
  };
  const previewRun = cameraRun.current;
  const currentPreview = () => editable() && focused.current && !scannerLock.current && camera && previewRun === cameraRun.current && AppState.currentState === "active";
  if (dataClient.current !== client) return <Text accessibilityLiveRegion="polite">Refreshing pantry entry for your sign-in…</Text>;
  return <Panel>
    <PanelHeader title="Add a packaged item" hint="Scan its barcode or type the label. You confirm the quantity and review it before inventory changes." />
    <View style={styles.fields}>
      <Text style={{ color: c.textMuted }}>Optional pantry recovery stores only this submitted name, quantity, unit and retry ID in encrypted device storage for up to 24 hours. It is separate from food-note copies. Expired copies are removed on the next access, not while the app is closed. No automatic send or inventory change. Other devices are not erased.</Text>
      {device.status === "checking" ? <Text accessibilityLiveRegion="polite" style={{ color: c.textMuted }}>Checking this account's pantry recovery…</Text> : null}
      {!durable.current && (device.status === "review" || device.status === "invalid" || device.status === "blocked") ? <View style={styles.fields}>
        <Callout tone="info">{device.status === "review" ? "A pantry recovery copy is available on this device. Review or discard it before adding another item." : "Device recovery needs review or deliberate discard before adding another item."}</Callout>
        <Button label="Check pantry recovery" disabled={busy} onPress={() => void inspectCopy(false)} />
        {reviewCopy && device.status === "review" ? <View><Text style={{ color: c.text }}>{device.record.input.items[0]!.displayName}; quantity {device.record.input.items[0]!.quantity ?? "unknown"} {device.record.input.items[0]!.unit ?? ""}. An earlier review may already have saved.</Text>
          <Button label="Resume this exact review" disabled={busy} onPress={() => void inspectCopy(true)} /></View> : null}
        <Button label="Discard pantry recovery" variant="ghost" disabled={busy} onPress={discardCopy} />
      </View> : null}
      {!submitted.current && recoveryAllowsEntry() ? <Button label={copyConsent ? "Keep device recovery for this review: on" : "Keep device recovery for this review: off"} variant="toggle" selected={copyConsent} disabled={busy} onPress={() => { if (editable() && renderedVersion === version.current) setCopyConsent(!copyConsentRef.current); }} /> : null}
      <Text style={{ color: c.text }}>Product barcode</Text>
      <Field accessibilityLabel="Product barcode" keyboardType="number-pad" value={barcode} maxLength={14} editable={!busy && !uncertain && recoveryAllowsEntry()} onChangeText={value => { if (editable()) setBarcode(value); }} />
      <View style={styles.actions}>
        <Button label="Scan barcode" disabled={busy || uncertain || camera || !recoveryAllowsEntry()} onPress={() => void startCamera()} />
        <Button label={busy ? "Working…" : "Look up label"} variant="ghost" disabled={busy || uncertain || !enabled || !recoveryAllowsEntry()} onPress={() => void lookup()} />
      </View>
      {camera ? <View>
        <CameraView style={styles.camera} facing="back" barcodeScannerSettings={{ barcodeTypes: ["ean8", "ean13", "upc_a", "upc_e", "itf14"] }}
          onMountError={() => { if (!currentPreview()) return; ++cameraRun.current; scannerLock.current = true; setCamera(false); setError("Camera could not open. Enter the barcode by hand."); }}
          onBarcodeScanned={event => {
            if (!currentPreview() || scannerLock.current) return;
            scannerLock.current = true; ++cameraRun.current;
            // UPC-E has eight digits but is not a GTIN-8. Ask for full UPC-A
            // instead of interpreting compressed codes as a different product.
            if (event.type === "upc_e") { setCamera(false); setError("Enter the full 12-digit product code printed on the package."); return; }
            try { const code = parseProductBarcode(event.data); setBarcode(code); setCamera(false); setNotice("Barcode found. Choose Look up label, or enter the product name below."); }
            catch { setCamera(false); setError("This code was not a valid product barcode. Enter the full digits by hand."); }
          }} />
        <Button label="Close camera" variant="ghost" onPress={() => { if (!currentPreview()) return; ++cameraRun.current; scannerLock.current = true; setCamera(false); }} />
      </View> : null}
      {enabled === false ? <Text style={{ color: c.textMuted }}>Lookup is unavailable in this build. Enter the product below.</Text> : null}
      {enabled === null && !availabilityError ? <Text accessibilityLiveRegion="polite" style={{ color: c.textMuted }}>Checking lookup availability… Manual entry is ready below.</Text> : null}
      {availabilityError ? <View style={styles.fields}><Callout tone="info">Could not check lookup availability. Your entry is still here and manual entry works.</Callout>
        <Button label="Check lookup availability again" variant="ghost" onPress={() => { if (current()) setAvailabilityVisit(value => value + 1); }} />
      </View> : null}
      {product ? <View><Text style={{ color: c.textMuted }}>{product.brand ?? ""} {product.packageLabel ? `Package label: ${product.packageLabel}.` : ""} Open Food Facts data (ODbL) can be incomplete. Check your package for allergens.</Text>
        <Button label="View Open Food Facts source" variant="ghost" onPress={() => { if (current()) void Linking.openURL(product.sourceUrl).catch(() => { if (current()) setError("Could not open the source link."); }); }} /></View> : null}
      <Text style={{ color: c.text }}>Product name, editable</Text>
      <Field accessibilityLabel="Product name, editable" value={name} maxLength={120} editable={!busy && !uncertain && recoveryAllowsEntry()} onChangeText={value => { if (!editable()) return; setName(value); reference.current = null; }} />
      <Text style={{ color: c.text }}>Quantity you currently have (optional)</Text>
      <Field accessibilityLabel="Quantity you currently have, optional" keyboardType="decimal-pad" value={amount} editable={!busy && !uncertain && recoveryAllowsEntry()} onChangeText={value => { if (!editable()) return; setAmount(value); reference.current = null; }} />
      <Field accessibilityLabel="Quantity unit" value={unit} maxLength={40} editable={!busy && !uncertain && recoveryAllowsEntry()} onChangeText={value => { if (!editable()) return; setUnit(value); reference.current = null; }} />
      <Text style={{ color: c.textMuted }}>Package size is not the number purchased. Leave quantity blank if unsure. Accepting replaces a matching pantry entry rather than adding to its old quantity.</Text>
      <Button label={uncertain ? "Retry the same pantry review" : "Queue item for pantry review"} disabled={busy || !name.trim() || (!submitted.current && !recoveryAllowsEntry())} onPress={() => void queue()} />
      {uncertain ? <Button label="Discard local entry" variant="ghost" disabled={busy} onPress={() => { if (!current() || action.current || !renderedSubmission || submitted.current !== renderedSubmission) return; if (copyConsentRef.current || durable.current) { discardCopy(); return; } Alert.alert("Discard local entry?", "The earlier review may already have saved. Check reviews before adding it again.", [
        { text: "Keep entry", style: "cancel" }, { text: "Discard local entry", style: "destructive", onPress: () => {
          if (!current() || action.current || submitted.current !== renderedSubmission) return;
          ++version.current;
          setUncertain(false); setName(""); setAmount(""); setBarcode(""); setProduct(null); setError(null); reference.current = null; submitted.current = null;
        } },
      ]); }} /> : null}
      {notice ? <Callout tone="info">{notice}</Callout> : null}
      {error ? <Callout tone="error">{error}</Callout> : null}
    </View>
  </Panel>;
}
const styles = StyleSheet.create({ fields: { gap: space.sm }, actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm }, camera: { height: 260, width: "100%" } });
