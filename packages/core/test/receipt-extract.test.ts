import assert from "node:assert/strict";
import test from "node:test";
import type Anthropic from "@anthropic-ai/sdk";
import { extractReceiptPhoto, ReceiptExtractionError } from "../src/receipt-extract.js";

function client(parsed_output: unknown, stop_reason: string = "end_turn") {
  return { messages: { parse: async () => ({ parsed_output, stop_reason }) } } as unknown as Anthropic;
}

test("receipt extraction returns only normalized review items", async () => {
  const result = await extractReceiptPhoto("aW1hZ2U=", "image/jpeg", { client: client({
    store: " Neighborhood Market ",
    items: [
      { displayName: "BANANAS", quantity: 6, unit: null },
      { displayName: "Large Tomatoes", quantity: 2, unit: "count" },
    ],
  }) });
  assert.equal(result.sourceLabel, "Neighborhood Market");
  assert.deepEqual(result.items.map(item => item.canonicalItem), ["banana", "tomato"]);
});

test("receipt extraction refuses empty and refused output without inventing items", async () => {
  await assert.rejects(extractReceiptPhoto("aW1hZ2U=", "image/png", { client: client({ store: null, items: [] }) }), ReceiptExtractionError);
  await assert.rejects(extractReceiptPhoto("aW1hZ2U=", "image/png", { client: client(null, "refusal") }), ReceiptExtractionError);
});
