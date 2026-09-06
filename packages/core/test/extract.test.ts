import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, describe, it } from "node:test";
import Anthropic from "@anthropic-ai/sdk";
import { extractRecipe } from "../src/extract.js";
import { ingestDocument, ingestText } from "../src/ingest.js";
import { EmptyExtractionError } from "../src/sources/types.js";
import type { ExtractedRecipe } from "../src/recipe.js";
import type { SourceDocument } from "../src/sources/types.js";

/**
 * These tests run the real SDK against a local stand-in for the Messages API.
 * That covers everything we own — request shape, schema round-trip, and the
 * normalization we apply on the way out — without needing a key or spending money.
 */

const modelRecipe: ExtractedRecipe = {
  title: "Garlic Butter Noodles",
  description: "A ten-minute noodle dish.",
  servings: 2,
  servingsNote: "serves 2",
  prepMinutes: 5,
  cookMinutes: 10,
  totalMinutes: 15,
  ingredients: [
    {
      raw: "about four cloves of garlic",
      quantity: 4,
      quantityMax: null,
      unit: "clove",
      item: "garlic",
      canonicalItem: "Garlic Cloves", // deliberately un-normalized
      notes: "thinly sliced",
      optional: false,
      group: null,
    },
    {
      raw: "a big knob of butter",
      quantity: 3,
      quantityMax: null,
      unit: "tbsp",
      item: "unsalted butter",
      canonicalItem: "",  // deliberately empty, to exercise the fallback
      notes: null,
      optional: false,
      group: null,
    },
  ],
  steps: [
    { n: 5, text: "Boil the noodles until al dente.", timerSeconds: 480, sourceTimestamp: 30 },
    { n: 9, text: "Melt the butter and add the sliced garlic.", timerSeconds: null, sourceTimestamp: null },
  ],
  equipment: ["large pot"],
  tags: ["#Weeknight", "weeknight", "QUICK"],
  cuisine: "Italian",
  course: "dinner",
  difficulty: "easy",
  confidence: 1.4, // deliberately out of range
  extractionNotes: ["Butter amount was gestured at; estimated 3 tbsp."],
  ingredientNutritionGuesses: [],
};

let server: Server;
let baseURL: string;
let lastBody: Record<string, unknown>;

before(async () => {
  server = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      lastBody = JSON.parse(raw) as Record<string, unknown>;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          id: "msg_test",
          type: "message",
          role: "assistant",
          model: "claude-opus-5",
          content: [{ type: "text", text: JSON.stringify(modelRecipe) }],
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 100, output_tokens: 200 },
        }),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  baseURL = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});

after(() => server.close());

const client = () => new Anthropic({ apiKey: "test-key", baseURL, maxRetries: 0 });

const transcriptDoc = (): SourceDocument => ({
  kind: "youtube",
  url: "https://www.youtube.com/watch?v=abc123",
  title: "10 Minute Garlic Noodles",
  author: "Some Cook",
  siteName: "youtube",
  imageUrl: "https://i.ytimg.com/vi/abc123/maxresdefault.jpg",
  text: "[00:30] okay so first get your water boiling\n[01:10] now melt some butter in a pan and throw in the garlic",
  textKind: "transcript",
  cues: [
    { start: 30, text: "okay so first get your water boiling for the noodles" },
    { start: 70, text: "now melt some butter in a pan and throw in the sliced garlic" },
  ],
  trace: [],
});

const photoDoc = (): SourceDocument => ({
  kind: "photo",
  url: null,
  title: "Grandma's index card",
  author: null,
  siteName: null,
  imageUrl: null,
  text: "",
  textKind: "photo",
  image: { base64: "ZmFrZS1pbWFnZS1ieXRlcw==", mediaType: "image/jpeg" },
  trace: ["photographed page"],
});

describe("extractRecipe request shape", () => {
  it("sends the parameters the extraction depends on", async () => {
    await extractRecipe(transcriptDoc(), { client: client() });

    assert.equal(lastBody.model, "claude-opus-5");
    assert.deepEqual(lastBody.thinking, { type: "adaptive" });

    const outputConfig = lastBody.output_config as Record<string, unknown>;
    assert.equal(outputConfig.effort, "medium");
    assert.ok(outputConfig.format, "a JSON output format must be attached");

    // The system prompt is the stable prefix we want cached across every import.
    const system = lastBody.system as { text: string; cache_control?: unknown }[];
    assert.ok(system[0]?.cache_control, "system prompt should carry a cache breakpoint");
  });

  it("gives the model transcript-specific guidance and the source metadata", async () => {
    await extractRecipe(transcriptDoc(), { client: client() });
    const messages = lastBody.messages as { content: string }[];
    const prompt = messages[0]!.content;
    assert.match(prompt, /auto-generated transcript/);
    assert.match(prompt, /10 Minute Garlic Noodles/);
    assert.match(prompt, /youtube\.com\/watch\?v=abc123/);
  });

  it("switches guidance for a blog article", async () => {
    await extractRecipe({ ...transcriptDoc(), textKind: "article" }, { client: client() });
    const messages = lastBody.messages as { content: string }[];
    assert.match(messages[0]!.content, /food blog page/);
  });

  it("sends a photo as an image content block, not interpolated text", async () => {
    await extractRecipe(photoDoc(), { client: client() });
    const messages = lastBody.messages as {
      content: { type: string; source?: { type: string; media_type: string; data: string }; text?: string }[];
    }[];
    const content = messages[0]!.content;
    assert.ok(Array.isArray(content), "a photo source must send array content, not a plain string");

    const image = content.find((b) => b.type === "image");
    assert.ok(image, "the image block must be present");
    assert.equal(image!.source!.type, "base64");
    assert.equal(image!.source!.media_type, "image/jpeg");
    assert.equal(image!.source!.data, "ZmFrZS1pbWFnZS1ieXRlcw==");

    const text = content.find((b) => b.type === "text");
    assert.match(text!.text!, /photograph of a physical page/);
    assert.match(text!.text!, /Grandma's index card/);
    // The empty CONTENT/text-body wrapper used for text sources must not leak
    // into a photo request, which has no transcript to interpolate.
    assert.doesNotMatch(text!.text!, /--- CONTENT ---/);
  });

  it("honours a lower effort setting for cheap re-runs", async () => {
    await extractRecipe(transcriptDoc(), { client: client(), effort: "low" });
    assert.equal((lastBody.output_config as Record<string, unknown>).effort, "low");
  });
});

describe("extractRecipe normalization", () => {
  it("re-canonicalizes ingredient keys the model returned loosely", async () => {
    const r = await extractRecipe(transcriptDoc(), { client: client() });
    assert.equal(r.ingredients[0]!.canonicalItem, "garlic clove");
    // Empty canonicalItem falls back to canonicalizing the item itself.
    assert.equal(r.ingredients[1]!.canonicalItem, "butter");
  });

  it("renumbers steps from 1 regardless of what the model emitted", async () => {
    const r = await extractRecipe(transcriptDoc(), { client: client() });
    assert.deepEqual(r.steps.map((s) => s.n), [1, 2]);
  });

  it("dedupes and cleans tags", async () => {
    const r = await extractRecipe(transcriptDoc(), { client: client() });
    assert.deepEqual(r.tags, ["weeknight", "quick"]);
  });

  it("clamps confidence into 0..1", async () => {
    const r = await extractRecipe(transcriptDoc(), { client: client() });
    assert.equal(r.confidence, 1);
  });
});

describe("ingest", () => {
  it("stamps the source and a fresh id onto the recipe", async () => {
    const { recipe, freeExtraction } = await ingestText("some pasted recipe text", {
      client: client(),
      nutrition: { skipUsda: true },
    });
    assert.equal(recipe.source.kind, "text");
    assert.equal(recipe.source.extractionMethod, "article-llm");
    assert.match(recipe.id, /^[0-9a-f-]{36}$/);
    assert.equal(freeExtraction, false);
  });

  it("backfills video timestamps onto steps the model left untagged", async () => {
    const { recipe } = await ingestDocument(transcriptDoc(), {
      client: client(),
      nutrition: { skipUsda: true },
    });

    // The model tagged step 1 itself; step 2 is matched against the cues by wording.
    assert.equal(recipe.steps[0]!.sourceTimestamp, 30);
    assert.equal(recipe.steps[1]!.sourceTimestamp, 70);
  });

  it("never walks a step's timestamp backwards through the video", async () => {
    const doc = transcriptDoc();
    doc.cues = [
      { start: 200, text: "melt some butter and add sliced garlic at the end too" },
      ...doc.cues!,
    ];
    const { recipe } = await ingestDocument(doc, { client: client(), nutrition: { skipUsda: true } });
    assert.ok(recipe.steps[1]!.sourceTimestamp! >= recipe.steps[0]!.sourceTimestamp!);
  });

  it("uses the page's own recipe without calling the model when one is available", async () => {
    const doc = { ...transcriptDoc(), kind: "web" as const, textKind: "article" as const };
    const before = lastBody;
    const { recipe, freeExtraction, trace } = await ingestDocument({
      ...doc,
      prestructured: {
        ...modelRecipe,
        title: "From the page itself",
        confidence: 0.95,
      },
    });

    assert.equal(freeExtraction, true);
    assert.equal(recipe.title, "From the page itself");
    assert.equal(recipe.source.extractionMethod, "schema-org");
    assert.equal(lastBody, before, "no request should have been made");
    assert.ok(trace.some((t) => t.includes("no model call")));
  });

  it("honors prestructuredMethod, for a prestructured recipe that didn't come from the page's own schema.org data", async () => {
    const doc = { ...transcriptDoc(), kind: "paprika" as const, textKind: "raw" as const };
    const before = lastBody;
    const { recipe, freeExtraction, trace } = await ingestDocument({
      ...doc,
      prestructured: { ...modelRecipe, title: "Imported from Paprika" },
      prestructuredMethod: "file-import",
    });

    assert.equal(freeExtraction, true);
    assert.equal(recipe.source.extractionMethod, "file-import");
    assert.equal(lastBody, before, "no request should have been made");
    assert.ok(trace.some((t) => t.includes("structured export from another app")));
  });

  it("refuses an extraction with nothing in it, rather than saving an empty card", async () => {
    // How a paywalled newsletter post became a library entry titled
    // "No recipe found" with no ingredients and no steps.
    const doc = { ...transcriptDoc(), kind: "web" as const, textKind: "article" as const };

    await assert.rejects(
      () =>
        ingestDocument({
          ...doc,
          prestructured: { ...modelRecipe, ingredients: [], steps: [], extractionNotes: [] },
        }),
      /No recipe could be read from that page\.$/,
    );
  });

  it("throws EmptyExtractionError specifically for an empty result, not the general ResolveError", async () => {
    // ingestUrl's own retry (caption looked plausible, extraction came back
    // empty, try a transcript instead) keys off this exact subclass — it
    // must not fire for every failure, only this one.
    const doc = { ...transcriptDoc(), kind: "web" as const, textKind: "article" as const };
    await assert.rejects(
      () =>
        ingestDocument({
          ...doc,
          prestructured: { ...modelRecipe, ingredients: [], steps: [], extractionNotes: [] },
        }),
      (err: unknown) => err instanceof EmptyExtractionError,
    );
  });

  it("passes on the model's own reason for finding nothing", async () => {
    // The model explains itself better than any generic message could.
    const doc = { ...transcriptDoc(), kind: "web" as const, textKind: "article" as const };

    await assert.rejects(
      () =>
        ingestDocument({
          ...doc,
          prestructured: {
            ...modelRecipe,
            ingredients: [],
            steps: [],
            extractionNotes: ["The recipe is behind a paywall."],
          },
        }),
      /behind a paywall/,
    );
  });

  it("still accepts a recipe that has steps but no ingredient list", async () => {
    // Deliberately conservative: only refuse when *both* are empty.
    const doc = { ...transcriptDoc(), kind: "web" as const, textKind: "article" as const };
    const { recipe } = await ingestDocument({
      ...doc,
      prestructured: { ...modelRecipe, ingredients: [] },
    });
    assert.equal(recipe.ingredients.length, 0);
    assert.ok(recipe.steps.length > 0);
  });
});
