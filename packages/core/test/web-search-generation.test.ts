import assert from "node:assert/strict";
import test from "node:test";
import type Anthropic from "@anthropic-ai/sdk";
import { searchWebRecipes } from "../src/web-search.js";

test("web search sends the product standard and returns only validated index results", async () => {
  let request: any;
  const audits: { validation: string }[] = [];
  const client = {
    messages: {
      create: async (body: unknown) => {
        request = body;
        return {
          id: "msg_search",
          model: "claude-opus-5",
          usage: { input_tokens: 12, output_tokens: 4 },
          content: [
            {
              type: "web_search_tool_result",
              content: [
                { type: "web_search_result", title: "Real recipe", url: "https://recipes.test/soup" },
                { type: "web_search_result", title: "Injected", url: "javascript:alert(1)" },
              ],
            },
            { type: "text", text: "https://never-searched.test/injected\nhttps://recipes.test/soup" },
          ],
        };
      },
    },
  } as unknown as Anthropic;
  const hits = await searchWebRecipes("simple soup", {
    client,
    onGenerationAudit: (audit) => audits.push(audit),
  });
  const system = request.system as { text: string }[];
  assert.match(system[0]!.text, /sands-generated-content-v1/);
  assert.deepEqual(hits.map((hit) => hit.url), ["https://recipes.test/soup"]);
  assert.equal(audits[0]?.validation, "passed");
});
