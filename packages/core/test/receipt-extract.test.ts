import assert from "node:assert/strict";
import test from "node:test";
import type Anthropic from "@anthropic-ai/sdk";
import { extractReceiptPhoto, ReceiptExtractionError } from "../src/receipt-extract.js";

function client(parsed_output: unknown, stop_reason: string = "end_turn", capture?: (body: unknown) => void) {
  return { messages: { parse: async (body: unknown) => {
    capture?.(body);
    return { id: "msg_receipt", model: "claude-opus-5", usage: { input_tokens: 2, output_tokens: 3 }, parsed_output, stop_reason };
  } } } as unknown as Anthropic;
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

test("receipt extraction sends the standard, strips controls, and deduplicates items", async () => {
  let request: any;
  const result = await extractReceiptPhoto("aW1hZ2U=", "image/jpeg", {
    client: client({
      store: "Market\u202e",
      items: [
        { displayName: "BANANAS", quantity: 6, unit: "count" },
        { displayName: "banana\u0000", quantity: 1, unit: null },
      ],
    }, "end_turn", (body) => { request = body; }),
  });
  assert.match(String(request.system), /sands-generated-content-v1/);
  assert.equal(result.sourceLabel, "Market");
  assert.equal(result.items.length, 1);
});

test("receipt extraction refuses empty and refused output without inventing items", async () => {
  await assert.rejects(extractReceiptPhoto("aW1hZ2U=", "image/png", { client: client({ store: null, items: [] }) }), ReceiptExtractionError);
  await assert.rejects(extractReceiptPhoto("aW1hZ2U=", "image/png", { client: client(null, "refusal") }), ReceiptExtractionError);
});
