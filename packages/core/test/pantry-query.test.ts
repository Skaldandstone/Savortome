import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type Anthropic from "@anthropic-ai/sdk";
import { interpretPantryQuery, needsInterpretation, parseQueryLocally } from "../src/pantry-query.js";

describe("needsInterpretation", () => {
  it("treats a comma-separated list as a plain ingredient list", () => {
    assert.equal(needsInterpretation("chicken, rice, broccoli"), false);
    assert.equal(needsInterpretation("eggs, milk, bread, butter, cheese, ham, spinach"), false);
  });

  it("treats a short phrase with no constraint words as a list too", () => {
    assert.equal(needsInterpretation("chicken thighs and rice"), false);
    assert.equal(needsInterpretation("eggs"), false);
  });

  it("sends a long, comma-free phrase to the model — too ambiguous to guess locally", () => {
    assert.equal(needsInterpretation("chicken rice broccoli onion garlic ginger soy sauce"), true);
  });

  it("recognizes a constraint word regardless of length or commas", () => {
    for (const text of [
      "something quick with chicken",
      "no dairy please",
      "gluten free dinner",
      "leftover turkey, rice, and peas",
      "vegetarian",
    ]) {
      assert.equal(needsInterpretation(text), true, text);
    }
  });

  it("treats empty or blank input as a plain list, not a request", () => {
    assert.equal(needsInterpretation(""), false);
    assert.equal(needsInterpretation("   "), false);
  });
});

it("sends the product standard and validates model filters before use", async () => {
  let body: Record<string, unknown> = {};
  const audits: { validation: string }[] = [];
  const client = {
    messages: {
      parse: async (request: Record<string, unknown>) => {
        body = request;
        return {
          id: "msg_pantry",
          model: "claude-opus-5",
          usage: { input_tokens: 10, output_tokens: 5 },
          stop_reason: "end_turn",
          parsed_output: {
            ingredients: ["Chicken Thighs"],
            excludeIngredients: [],
            tags: ["#Quick"],
            maxMinutes: 30,
            course: "dinner",
          },
        };
      },
    },
  } as unknown as Anthropic;

  const result = await interpretPantryQuery("quick dinner with chicken thighs", {
    client,
    onGenerationAudit: (audit) => audits.push(audit),
  });
  const system = body.system as { text: string }[];
  assert.match(system[0]!.text, /sands-generated-content-v1/);
  assert.deepEqual(result.query.ingredients, ["chicken thigh"]);
  assert.equal(result.interpreted, true);
  assert.equal(audits[0]?.validation, "passed");
});

it("falls back deterministically when a generated filter is outside the allowlist", async () => {
  const client = {
    messages: {
      parse: async () => ({
        id: "msg_bad",
        model: "claude-opus-5",
        usage: { input_tokens: 1, output_tokens: 1 },
        stop_reason: "end_turn",
        parsed_output: {
          ingredients: ["chicken"], excludeIngredients: [], tags: [], maxMinutes: 30, course: "brunch",
        },
      }),
    },
  } as unknown as Anthropic;
  const result = await interpretPantryQuery("quick brunch with chicken", { client });
  assert.equal(result.interpreted, false);
  assert.ok(result.query.ingredients.length > 0);
});

describe("parseQueryLocally", () => {
  it("puts everything typed into ingredients and leaves the rest empty", () => {
    const query = parseQueryLocally("chicken, rice, broccoli");
    assert.deepEqual(query.ingredients.sort(), ["broccoli", "chicken", "rice"]);
    assert.deepEqual(query.excludeIngredients, []);
    assert.deepEqual(query.tags, []);
    assert.equal(query.maxMinutes, null);
    assert.equal(query.course, null);
  });

  it("returns nothing for blank input", () => {
    assert.deepEqual(parseQueryLocally("").ingredients, []);
  });
});
