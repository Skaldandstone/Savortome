import { parseProductBarcode, type BarcodeProductDraft } from "./barcode.js";
import { sanitizeGeneratedText } from "./generated-content.js";

export class BarcodeLookupError extends Error {
  constructor(readonly status: 429 | 503 = 503) {
    super(status === 429 ? "Product lookup is busy. Wait a moment or enter the item by hand." : "Product lookup is unavailable. You can enter the item by hand.");
    this.name = "BarcodeLookupError";
  }
}

const MAX_RESPONSE_BYTES = 32_768;
let nextLookupAt = 0;

/** Fixed-origin, bounded read. No account or food preferences leave this boundary. */
export async function lookupBarcodeProduct(value: unknown, options: {
  userAgent: string;
  fetch?: typeof fetch;
  now?: () => number;
}): Promise<BarcodeProductDraft | null> {
  const barcode = parseProductBarcode(value);
  const now = (options.now ?? Date.now)();
  // OFF permits 15 product reads/min/IP. Conservative process-local spacing;
  // multi-instance enablement needs a shared egress limit before rollout.
  if (now < nextLookupAt) throw new BarcodeLookupError(429);
  nextLookupAt = now + 5_000;
  const upstreamCode = barcode.length === 12 ? `0${barcode}` : barcode;
  const url = new URL(`https://world.openfoodfacts.org/api/v3.6/product/${upstreamCode}.json`);
  url.searchParams.set("fields", "product_name,brands,quantity");
  try {
    const response = await (options.fetch ?? fetch)(url, {
      headers: { "User-Agent": options.userAgent, accept: "application/json" },
      redirect: "error", cache: "no-store", signal: AbortSignal.timeout(8_000),
    });
    if (response.status === 404) return null;
    if (response.status === 429) throw new BarcodeLookupError(429);
    if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new BarcodeLookupError();
    const reader = response.body?.getReader();
    if (!reader) throw new BarcodeLookupError();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
      while (true) {
        const { value: chunk, done } = await reader.read();
        if (done) break;
        length += chunk.byteLength;
        if (length > MAX_RESPONSE_BYTES) throw new BarcodeLookupError();
        chunks.push(chunk);
      }
    } finally { await reader.cancel().catch(() => {}); }
    const bytes = new Uint8Array(length);
    let position = 0;
    for (const chunk of chunks) { bytes.set(chunk, position); position += chunk.byteLength; }
    const data: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!data || typeof data !== "object") throw new BarcodeLookupError();
    const body = data as Record<string, unknown>;
    if (body.status === 0) return null;
    if (!body.product || typeof body.product !== "object") throw new BarcodeLookupError();
    const product = body.product as Record<string, unknown>;
    const label = (v: unknown, max: number) => typeof v === "string" ? sanitizeGeneratedText(v, max) || null : null;
    const displayName = label(product.product_name, 120);
    if (!displayName) return null;
    return {
      barcode, displayName, brand: label(product.brands, 80), packageLabel: label(product.quantity, 80),
      source: "open_food_facts", sourceUrl: `https://world.openfoodfacts.org/product/${upstreamCode}`,
    };
  } catch (cause) {
    if (cause instanceof BarcodeLookupError) throw cause;
    // No provider payload, scanned product, URL or exception is logged.
    throw new BarcodeLookupError();
  }
}
