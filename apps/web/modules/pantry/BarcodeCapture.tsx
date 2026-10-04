"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { parseProductBarcode, type BarcodeProductDraft } from "@seconds/core/format";
import { api } from "@/lib/client";
import { Button, Callout, FieldRow, Panel, PanelHeader, TextField } from "@/ui";

/** Barcode lookup never saves inventory. The separate review queue owns acceptance. */
export function BarcodeCapture({ onQueued }: { onQueued: () => void }) {
  const { userId } = useAuth();
  const owner = useRef(userId); owner.current = userId;
  const version = useRef(0);
  const [enabled, setEnabled] = useState<boolean | null>(null);
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
    const run = ++version.current;
    setProduct(null); setName(""); setAmount(""); setBarcode(""); setError(null); setNotice(null); setBusy(false); setEnabled(null); reference.current = null;
    void api.barcodeLookupStatus().then(result => { if (version.current === run) setEnabled(result.enabled); })
      .catch(() => { if (version.current === run) setEnabled(false); });
    return () => { ++version.current; };
  }, [userId]);
  const lookup = async () => {
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
    } finally { if (owner.current === account && run === version.current) setBusy(false); }
  };
  const queue = async () => {
    const account = owner.current; const run = ++version.current;
    const quantity = amount.trim() ? Number(amount) : null;
    if (!name.trim() || (quantity !== null && (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000))) {
      setError("Enter the product name and a positive quantity, or leave quantity unknown."); return;
    }
    setBusy(true); setError(null); setNotice(null);
    try {
      reference.current ??= crypto.randomUUID();
      await api.createPantryIntake({ source: "barcode", externalReference: reference.current, sourceLabel: "Product entered for review", acquiredAt: null,
        items: [{ displayName: name.trim(), quantity, unit: quantity === null ? null : unit.trim() || null }] });
      if (owner.current !== account || run !== version.current) return;
      onQueued(); setNotice("Item queued for review below. Confirm it there before it changes your pantry.");
      setProduct(null); setName(""); setAmount(""); setBarcode(""); reference.current = null;
    } catch {
      if (owner.current === account && run === version.current) setError("We could not confirm that this review saved. Your entry is still here. Check the grocery reviews before retrying.");
    } finally { if (owner.current === account && run === version.current) setBusy(false); }
  };
  return <Panel>
    <PanelHeader title="Add a packaged item" hint="Look up a product barcode or enter the label yourself. Nothing goes into your pantry until you review it." />
    <form onSubmit={event => { event.preventDefault(); void lookup(); }}>
      <label htmlFor="pantry-barcode">Product barcode</label>
      <FieldRow><TextField id="pantry-barcode" inputMode="numeric" value={barcode} maxLength={14} disabled={busy} onChange={event => setBarcode(event.target.value)} />
        <Button type="submit" disabled={busy || !enabled}>{busy ? "Working…" : "Look up label"}</Button></FieldRow>
    </form>
    {enabled === false ? <p>Lookup is unavailable in this build. You can still enter the product below.</p> : null}
    {product ? <p>{product.brand ? `${product.brand}. ` : ""}{product.packageLabel ? `Package label: ${product.packageLabel}. ` : ""}
      Label from <a href={product.sourceUrl} target="_blank" rel="noreferrer">Open Food Facts</a> (ODbL). It may be incomplete or wrong. Check your package for allergens.</p> : null}
    <form onSubmit={event => { event.preventDefault(); void queue(); }}>
      <label htmlFor="pantry-product-name">Product name, editable</label>
      <TextField id="pantry-product-name" value={name} maxLength={120} disabled={busy} onChange={event => { setName(event.target.value); reference.current = null; }} />
      <FieldRow><label>Quantity you currently have (optional)<TextField inputMode="decimal" value={amount} disabled={busy} onChange={event => { setAmount(event.target.value); reference.current = null; }} /></label>
        <label>Unit<TextField value={unit} maxLength={40} disabled={busy} onChange={event => { setUnit(event.target.value); reference.current = null; }} /></label></FieldRow>
      <p>Package size does not tell us how many you bought. Leave the quantity blank if unsure. This review replaces a matching pantry entry; it does not add to its old quantity.</p>
      <Button type="submit" disabled={busy || !name.trim()}>Queue item for pantry review</Button>
    </form>
    {notice ? <Callout tone="info" role="status">{notice}</Callout> : null}
    {error ? <Callout tone="error" role="alert">{error}</Callout> : null}
  </Panel>;
}
