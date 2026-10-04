"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { signInReturnHref } from "@/lib/action-failure";
import { createClient, parseProductBarcode, type BarcodeProductDraft } from "@seconds/core/format";
import { Button, Callout, FieldRow, Panel, PanelHeader, TextField } from "@/ui";
import { BrowserBarcodeScanner } from "./BrowserBarcodeScanner";

/** Barcode lookup never saves inventory. The separate review queue owns acceptance. */
type CaptureProps = { onQueued: () => void; clerkEnabled?: boolean };
export function BarcodeCapture({ onQueued, clerkEnabled = true }: CaptureProps) {
  return clerkEnabled ? <AuthenticatedBarcodeCapture onQueued={onQueued} /> : <AccountBarcodeCapture onQueued={onQueued} />;
}
function AuthenticatedBarcodeCapture({ onQueued }: CaptureProps) {
  const { userId, sessionId, isLoaded } = useAuth();
  if (!isLoaded) return <p role="status">Loading your sign-in for pantry entry…</p>;
  if (!sessionId || !userId) return <Callout tone="info"><Link href={signInReturnHref("/cook")}>Sign in again before adding pantry items.</Link></Callout>;
  return <AccountBarcodeCapture key={sessionId ?? "signed-out"} onQueued={onQueued} userId={userId} sessionId={sessionId} />;
}
function AccountBarcodeCapture({ onQueued, userId, sessionId }: CaptureProps & { userId?: string | null; sessionId?: string | null }) {
  const api = useMemo(() => createClient({ expectedSessionId: sessionId ?? undefined }), [sessionId]);
  const owner = useRef(userId); owner.current = userId;
  const version = useRef(0);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [availabilityError, setAvailabilityError] = useState(false);
  const [availabilityVisit, setAvailabilityVisit] = useState(0);
  const [camera, setCamera] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const action = useRef(false);
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
    ++version.current;
    action.current = false; setCamera(false); setUncertain(false); setAvailabilityError(false);
    setProduct(null); setName(""); setAmount(""); setBarcode(""); setError(null); setNotice(null); setBusy(false); setEnabled(null); reference.current = null;
    return () => { ++version.current; };
  }, [userId, api]);
  useEffect(() => {
    let active = true; setEnabled(null); setAvailabilityError(false);
    void api.barcodeLookupStatus().then(result => { if (active) setEnabled(result.enabled); })
      .catch(() => { if (active) setAvailabilityError(true); });
    return () => { active = false; };
  }, [api, availabilityVisit]);
  const lookup = async () => {
    if (action.current || uncertain || !enabled) return;
    action.current = true; setCamera(false);
    const account = owner.current; const run = ++version.current;
    setError(null); setNotice(null); setBusy(true);
    try {
      const code = parseProductBarcode(barcode);
      const { product: result } = await api.lookupProductBarcode(code);
      if (owner.current !== account || run !== version.current) return;
      setProduct(result); setName(result?.displayName ?? ""); setAmount(""); reference.current = null;
      if (!result) setNotice("No product label was found. Enter its name and the quantity you have below.");
    } catch (cause) {
      if (owner.current === account && run === version.current) setError(cause instanceof Error ? cause.message : "Lookup failed. Enter the item by hand.");
    } finally { if (owner.current === account && run === version.current) { action.current = false; setBusy(false); } }
  };
  const queue = async () => {
    if (action.current) return;
    const quantity = amount.trim() ? Number(amount) : null;
    if (!name.trim() || (quantity !== null && (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000))) {
      setError("Enter the product name and a positive quantity, or leave quantity unknown."); return;
    }
    action.current = true; setCamera(false);
    const account = owner.current; const run = ++version.current;
    setBusy(true); setError(null); setNotice(null);
    try {
      reference.current ??= crypto.randomUUID();
      await api.createPantryIntake({ source: "barcode", externalReference: reference.current, sourceLabel: "Product entered for review", acquiredAt: null,
        items: [{ displayName: name.trim(), quantity, unit: quantity === null ? null : unit.trim() || null }] });
      if (owner.current !== account || run !== version.current) return;
      setUncertain(false); onQueued(); setNotice("Item queued for review below. Confirm it there before it changes your pantry.");
      setProduct(null); setName(""); setAmount(""); setBarcode(""); reference.current = null;
    } catch {
      if (owner.current === account && run === version.current) { setUncertain(true); setError("We could not confirm that this review saved. Your entry is kept unchanged for a safe retry. Check the grocery reviews below first."); }
    } finally { if (owner.current === account && run === version.current) { action.current = false; setBusy(false); } }
  };
  return <Panel>
    <PanelHeader title="Add a packaged item" hint="Look up a product barcode or enter the label yourself. Nothing goes into your pantry until you review it." />
    <form onSubmit={event => { event.preventDefault(); void lookup(); }}>
      <label htmlFor="pantry-barcode">Product barcode</label>
      <FieldRow><TextField id="pantry-barcode" inputMode="numeric" value={barcode} maxLength={14} disabled={busy || uncertain} onChange={event => setBarcode(event.target.value)} />
        <Button type="submit" disabled={busy || uncertain || !enabled}>{busy ? "Working…" : "Look up label"}</Button>
        <Button type="button" disabled={busy || uncertain || camera} onClick={() => setCamera(true)}>Scan barcode with camera</Button></FieldRow>
    </form>
    {camera ? <BrowserBarcodeScanner key={userId} onClose={() => { setCamera(false); document.getElementById("pantry-barcode")?.focus(); }} onCode={code => { setCamera(false); setBarcode(code); setNotice("Barcode found. Choose Look up label, or enter the product name below."); document.getElementById("pantry-barcode")?.focus(); }} /> : null}
    {enabled === null && !availabilityError ? <p role="status">Checking product lookup availability… Manual entry is ready below.</p> : null}
    {availabilityError ? <Callout tone="info" role="status">Could not check product lookup availability. Your entry is still here and manual entry works.
      <Button type="button" onClick={() => setAvailabilityVisit(value => value + 1)}>Check lookup availability again</Button>
    </Callout> : null}
    {enabled === false ? <p>Lookup is unavailable in this build. You can still enter the product below.</p> : null}
    {product ? <p>{product.brand ? `${product.brand}. ` : ""}{product.packageLabel ? `Package label: ${product.packageLabel}. ` : ""}
      Label from <a href={product.sourceUrl} target="_blank" rel="noreferrer">Open Food Facts</a> (ODbL). It may be incomplete or wrong. Check your package for allergens.</p> : null}
    <form onSubmit={event => { event.preventDefault(); void queue(); }}>
      <label htmlFor="pantry-product-name">Product name, editable</label>
      <TextField id="pantry-product-name" value={name} maxLength={120} disabled={busy || uncertain} onChange={event => { setName(event.target.value); reference.current = null; }} />
      <FieldRow><label>Quantity you currently have (optional)<TextField inputMode="decimal" value={amount} disabled={busy || uncertain} onChange={event => { setAmount(event.target.value); reference.current = null; }} /></label>
        <label>Unit<TextField value={unit} maxLength={40} disabled={busy || uncertain} onChange={event => { setUnit(event.target.value); reference.current = null; }} /></label></FieldRow>
      <p>Package size does not tell us how many you bought. Leave the quantity blank if unsure. This review replaces a matching pantry entry; it does not add to its old quantity.</p>
      <Button type="submit" disabled={busy || !name.trim()}>{uncertain ? "Retry the same pantry review" : "Queue item for pantry review"}</Button>
      {uncertain ? <Button type="button" disabled={busy} onClick={() => {
        if (!window.confirm("Discard this local entry? The earlier review may already have saved. Check reviews before adding it again.")) return;
        setUncertain(false); setName(""); setAmount(""); setBarcode(""); setProduct(null); setError(null); reference.current = null;
      }}>Discard local entry</Button> : null}
    </form>
    {notice ? <Callout tone="info" role="status">{notice}</Callout> : null}
    {error ? <Callout tone="error" role="alert">{error}</Callout> : null}
  </Panel>;
}
