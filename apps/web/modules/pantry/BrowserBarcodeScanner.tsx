"use client";
import { useEffect, useRef, useState } from "react";
import { parseProductBarcode } from "@seconds/core/format";
import { Button, Callout } from "@/ui";
import styles from "./barcode.module.css";

type Detector = { detect(image: HTMLVideoElement): Promise<Array<{ rawValue: string; format: string }>> };
type DetectorConstructor = { new(options: { formats: string[] }): Detector; getSupportedFormats(): Promise<string[]> };
const formats = ["ean_8", "ean_13", "upc_a", "itf"];

/** Local decoding only: no frame upload, URL navigation or automatic lookup. */
export function BrowserBarcodeScanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const onCodeRef = useRef(onCode); onCodeRef.current = onCode;
  const onCloseRef = useRef(onClose); onCloseRef.current = onClose;
  const [message, setMessage] = useState("Opening camera…");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const stop = () => {
      active = false;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach(track => track.stop());
      if (video.current) video.current.srcObject = null;
    };
    const fail = (text: string) => { if (active) { stop(); setError(text); } };
    const hide = () => { if (document.hidden) { stop(); onCloseRef.current(); } };
    const leave = () => { stop(); onCloseRef.current(); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") leave(); };
    document.addEventListener("visibilitychange", hide);
    document.addEventListener("keydown", escape);
    window.addEventListener("pagehide", leave);
    // Includes a stalled permission prompt/detector. A late camera grant is
    // immediately stopped, even when the user already closed this component.
    const deadline = setTimeout(() => fail("Scanning paused. Try again or enter the barcode by hand."), 45000);
    void (async () => {
      try {
        const Constructor = (window as Window & { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
        if (!window.isSecureContext || !Constructor || !navigator.mediaDevices?.getUserMedia) {
          fail("Camera barcode scanning is unavailable in this browser. Enter the barcode or product name by hand."); return;
        }
        const supported = await Constructor.getSupportedFormats();
        if (!active) return;
        const allowed = formats.filter(format => supported.includes(format));
        if (!allowed.length) { fail("This browser cannot read product barcodes. Enter the barcode by hand."); return; }
        const detector = new Constructor({ formats: allowed });
        const opened = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } });
        if (!active || document.hidden) { opened.getTracks().forEach(track => track.stop()); return; }
        stream = opened;
        const element = video.current;
        if (!element) { stop(); return; }
        element.srcObject = opened;
        await element.play();
        if (!active) return;
        setMessage("Hold the product barcode in view. The camera closes when a valid code is found.");
        const scan = async () => {
          if (!active) return;
          try {
            if (element.readyState >= 2) {
              const results = await detector.detect(element);
              if (!active) return;
              for (const result of results) {
                if (!allowed.includes(result.format)) continue;
                // ITF is broader than GTIN-14; compressed UPC-E is never accepted.
                if (result.format === "itf" && result.rawValue.length !== 14) continue;
                try {
                  const code = parseProductBarcode(result.rawValue);
                  stop(); onCodeRef.current(code); return;
                } catch { /* Keep scanning, without transmitting invalid data. */ }
              }
            }
            if (active) timer = setTimeout(() => void scan(), 300);
          } catch { fail("The camera could not read this barcode. Enter it by hand instead."); }
        };
        void scan();
      } catch { fail("Camera access was not available. You can still enter the barcode or product name by hand."); }
    })();
    return () => {
      stop(); clearTimeout(deadline);
      document.removeEventListener("visibilitychange", hide);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("pagehide", leave);
    };
  }, []);
  return <section className={styles.scanner} aria-label="Product barcode camera">
    <video ref={video} className={styles.preview} muted playsInline aria-label="Live product barcode preview" hidden={!!error} />
    {error ? <Callout tone="info" role="status">{error}</Callout> : <p role="status">{message}</p>}
    <p>Camera frames stay on this device. Finding a code does not look it up or save anything.</p>
    <Button type="button" onClick={onClose}>Close camera and use manual entry</Button>
  </section>;
}
