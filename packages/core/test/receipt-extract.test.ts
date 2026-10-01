import assert from "node:assert/strict";
import test from "node:test";
import OpenAI from "openai";
import { extractReceiptPhoto, ReceiptExtractionError } from "../src/receipt-extract.js";

function client(output_parsed: unknown, status: string = "completed", capture?: (body: unknown) => void) {
  return { responses: { parse: async (body: unknown) => {
    capture?.(body);
    return { id: "resp_receipt", model: "gpt-4.1-mini-2025-04-14", usage: { input_tokens: 2, output_tokens: 3 }, output_parsed, status, output: [] };
  } } } as unknown as OpenAI;
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
    }, "completed", (body) => { request = body; }),
  });
  assert.match(String(request.instructions), /sands-generated-content-v1/);
  assert.equal(request.store, false);
  assert.equal(request.input[0].content[0].image_url, "data:image/jpeg;base64,aW1hZ2U=");
  assert.equal(result.sourceLabel, "Market");
  assert.equal(result.items.length, 1);
});

test("receipt extraction refuses empty and refused output without inventing items", async () => {
  await assert.rejects(extractReceiptPhoto("aW1hZ2U=", "image/png", { client: client({ store: null, items: [] }) }), ReceiptExtractionError);
  await assert.rejects(extractReceiptPhoto("aW1hZ2U=", "image/png", { client: client(null, "incomplete") }), ReceiptExtractionError);
});

test("receipt rejects invalid quantities even with a populated provider result", async () => {
  for (const quantity of [-1, 10001, "six"]) {
    await assert.rejects(extractReceiptPhoto("aW1hZ2U=", "image/png", { client: client({
      store: null, items: [{ displayName: "banana", quantity, unit: null }],
    }) }), ReceiptExtractionError);
  }
});

test("real OpenAI parser handles JSON and refusal without any network request", async () => {
  let request: any;
  let refusal = false;
  const sdk = new OpenAI({ apiKey: "test-placeholder", maxRetries: 0, fetch: async (_url, init) => {
    request = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({
      id: "resp_test", object: "response", created_at: 1, model: request.model,
      status: "completed", usage: { input_tokens: 10, output_tokens: 20 },
      output: [{ id: "msg_test", type: "message", role: "assistant", status: "completed", content: refusal
        ? [{ type: "refusal", refusal: "Unable to process" }]
        : [{ type: "output_text", text: JSON.stringify({ store: null, items: [{ displayName: "bananas", quantity: 6, unit: "count" }] }), annotations: [] }],
      }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  } });
  const audits: any[] = [];
  const result = await extractReceiptPhoto("aW1hZ2U=", "image/png", { client: sdk, onGenerationAudit: audit => audits.push(audit) });
  assert.equal(result.items[0].quantity, 6);
  assert.equal(request.store, false);
  assert.equal(request.text.format.type, "json_schema");
  assert.equal(request.text.format.strict, true);
  assert.equal(audits[0].provider, "openai");
  assert.equal(audits[0].inputTokens, 10);
  assert.equal(audits[0].sourceReference, "receipt-photo-v1");
  assert.equal(JSON.stringify(audits).includes("aW1hZ2U="), false);
  refusal = true;
  await assert.rejects(extractReceiptPhoto("aW1hZ2U=", "image/png", { client: sdk }), ReceiptExtractionError);
});
