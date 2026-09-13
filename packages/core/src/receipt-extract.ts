import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { canonicalize } from "./units.js";
import type { PhotoMediaType } from "./recipe.js";

export const RECEIPT_EXTRACTION_MODEL = "claude-opus-5";

const ReceiptSchema = z.object({
  store: z.string().trim().max(120).nullable(),
  items: z.array(z.object({
    displayName: z.string().trim().min(1).max(120),
    quantity: z.number().min(0).max(10_000).nullable(),
    unit: z.string().trim().max(40).nullable(),
  })).min(1).max(100),
});

export interface ReceiptExtraction {
  sourceLabel: string | null;
  items: Array<{ canonicalItem: string; displayName: string; quantity: number | null; unit: string | null }>;
}

export class ReceiptExtractionError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "ReceiptExtractionError";
  }
}

const SYSTEM = `Read a grocery receipt photo and return only food and drink items that may belong in a household pantry.

Exclude prices, subtotals, taxes, discounts, loyalty identifiers, payment details, addresses, phone numbers, cashier names, and transaction codes. Exclude non-food merchandise. Keep the receipt's useful item wording, expanding obvious receipt abbreviations only when confident. Quantity is the number of packages or individual produce items when the receipt states it; otherwise null. Unit is only a stated package unit such as lb, oz, kg, g, l, ml, pint, gallon, package, bunch, or count; otherwise null. Never infer consumption, nutrition needs, allergies, or whether an item is still available. If the image is not a readable grocery receipt, return no fabricated items.`;

export async function extractReceiptPhoto(
  base64: string,
  mediaType: PhotoMediaType,
  opts: { client?: Anthropic; model?: string; signal?: AbortSignal } = {},
): Promise<ReceiptExtraction> {
  const client = opts.client ?? new Anthropic();
  try {
    const response = await client.messages.parse({
      model: opts.model ?? RECEIPT_EXTRACTION_MODEL,
      max_tokens: 4_000,
      system: SYSTEM,
      output_config: { format: zodOutputFormat(ReceiptSchema), effort: "low" },
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
        { type: "text", text: "Extract the grocery items for a mandatory human review. Do not include any other receipt data." },
      ] }],
    }, { signal: opts.signal });
    if (response.stop_reason === "refusal") throw new ReceiptExtractionError("The receipt could not be processed. You can add the items manually.");
    if (!response.parsed_output || response.parsed_output.items.length === 0) throw new ReceiptExtractionError("No grocery items were found. Try a clearer photo or add them manually.");
    const items = response.parsed_output.items.map(item => ({
      canonicalItem: canonicalize(item.displayName),
      displayName: item.displayName.trim(),
      quantity: item.quantity,
      unit: item.unit?.trim() || null,
    })).filter(item => item.canonicalItem.length > 0);
    if (items.length === 0) throw new ReceiptExtractionError("No grocery items were found. Try a clearer photo or add them manually.");
    return {
      sourceLabel: response.parsed_output.store?.trim() || null,
      items,
    };
  } catch (error) {
    if (error instanceof ReceiptExtractionError) throw error;
    throw new ReceiptExtractionError("The receipt could not be read. Try a clearer photo or add the items manually.", error);
  }
}
