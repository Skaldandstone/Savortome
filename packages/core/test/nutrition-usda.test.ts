import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeNutrition, guessIngredientNutrition, rescaleNutrition, searchFood } from "../src/nutrition-usda.js";
import type { Ingredient } from "../src/recipe.js";
import type Anthropic from "@anthropic-ai/sdk";

/**
 * A stand-in for the FoodData Central API, same spirit as extract.test.ts's
 * stand-in for the Messages API — real request/response shapes, no network,
 * no rate limit spent on CI.
 */
function fakeUsda(
  byQuery: Record<string, { fdcId: number; description: string; nutrients: Record<string, number> }>,
): typeof fetch {
  return (async (url: string | URL) => {
    const u = new URL(url.toString());
    const query = u.searchParams.get("query") ?? "";
    const hit = byQuery[query];
    const foods = hit
      ? [
          {
            fdcId: hit.fdcId,
            description: hit.description,
            dataType: "Foundation",
            foodNutrients: Object.entries(hit.nutrients).map(([name, value]) => ({
              nutrientName: name,
              unitName: name === "Energy" ? "KCAL" : name === "Sodium, Na" ? "MG" : "G",
              value,
            })),
          },
        ]
      : [];
    return new Response(JSON.stringify({ foods }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
}

const failingFetch: typeof fetch = (async () => {
  throw new Error("network is down");
}) as typeof fetch;

const notOkFetch: typeof fetch = (async () => new Response("", { status: 500 })) as typeof fetch;

const ing = (over: Partial<Ingredient> = {}): Ingredient => ({
  raw: "",
  quantity: 1,
  quantityMax: null,
  unit: "cup",
  item: "flour",
  canonicalItem: "flour",
  notes: null,
  optional: false,
  group: null,
  ...over,
});

describe("searchFood", () => {
  it("returns per-100g nutrients from a matched food", async () => {
    const fetchImpl = fakeUsda({
      flour: {
        fdcId: 789890,
        description: "Flour, wheat, all-purpose",
        nutrients: {
          Energy: 364,
          Protein: 10.3,
          "Carbohydrate, by difference": 76.3,
          "Total lipid (fat)": 1,
          "Fiber, total dietary": 2.7,
          "Sodium, Na": 2,
        },
      },
    });
    const match = await searchFood("flour", { fetch: fetchImpl });
    assert.equal(match?.fdcId, 789890);
    assert.equal(match?.per100g.calories, 364);
    assert.equal(match?.per100g.proteinGrams, 10.3);
    assert.equal(match?.per100g.sodiumMg, 2);
  });

  it("returns null rather than throwing when nothing matches", async () => {
    const match = await searchFood("gochujang", { fetch: fakeUsda({}) });
    assert.equal(match, null);
  });

  it("returns null on a network failure — the fallback trigger, not a crash", async () => {
    const match = await searchFood("flour", { fetch: failingFetch });
    assert.equal(match, null);
  });

  it("returns null on a non-200 response", async () => {
    const match = await searchFood("flour", { fetch: notOkFetch });
    assert.equal(match, null);
  });
});

describe("computeNutrition", () => {
  it("prefers a USDA match over the model's guess when both are available", async () => {
    const fetchImpl = fakeUsda({
      flour: {
        fdcId: 1,
        description: "Flour",
        nutrients: { Energy: 364, Protein: 10, "Carbohydrate, by difference": 76, "Total lipid (fat)": 1, "Fiber, total dietary": 3, "Sodium, Na": 2 },
      },
    });
    const ingredients = [ing({ quantity: 1, unit: "cup", canonicalItem: "flour" })];
    const guesses = [{ canonicalItem: "flour", contribution: { calories: 1, proteinGrams: 1, carbGrams: 1, fatGrams: 1, fiberGrams: 1, sodiumMg: 1 } }];

    const result = await computeNutrition(ingredients, guesses, 1, { fetch: fetchImpl });
    assert.equal(result.perIngredient[0]!.source, "usda");
    // A cup of flour is roughly 128g, so ~1.28x the per-100g figure — nowhere
    // near the model's placeholder guess of 1.
    assert.ok(result.perIngredient[0]!.contribution.calories! > 300);
  });

  it("falls back to the model's guess when USDA has no match", async () => {
    const ingredients = [ing({ quantity: 1, unit: "cup", canonicalItem: "gochujang" })];
    const guesses = [{ canonicalItem: "gochujang", contribution: { calories: 45, proteinGrams: 1, carbGrams: 9, fatGrams: 0, fiberGrams: 0, sodiumMg: 800 } }];

    const result = await computeNutrition(ingredients, guesses, 1, { fetch: fakeUsda({}) });
    assert.equal(result.perIngredient[0]!.source, "estimated");
    assert.equal(result.perIngredient[0]!.contribution.calories, 45);
  });

  it("falls back to the model's guess when the amount can't be weighed at all", async () => {
    // "salt to taste" — a real, common case with no quantity to convert.
    const ingredients = [ing({ quantity: null, unit: null, canonicalItem: "salt" })];
    const guesses = [{ canonicalItem: "salt", contribution: { calories: 0, proteinGrams: 0, carbGrams: 0, fatGrams: 0, fiberGrams: 0, sodiumMg: 200 } }];

    const result = await computeNutrition(ingredients, guesses, 1, { fetch: fakeUsda({}) });
    assert.equal(result.perIngredient[0]!.source, "estimated");
    assert.equal(result.perIngredient[0]!.contribution.sodiumMg, 200);
  });

  it("contributes nothing, rather than fabricating a number, when neither source has an answer", async () => {
    const ingredients = [ing({ quantity: 1, unit: "cup", canonicalItem: "mystery item" })];
    const result = await computeNutrition(ingredients, [], 1, { fetch: fakeUsda({}) });
    assert.equal(result.perIngredient[0]!.source, "estimated");
    assert.equal(result.perIngredient[0]!.contribution.calories, 0);
  });

  it("skips the network entirely when asked to", async () => {
    let called = false;
    const spy: typeof fetch = (async () => {
      called = true;
      return new Response("{}");
    }) as typeof fetch;
    const ingredients = [ing({ canonicalItem: "flour" })];
    await computeNutrition(ingredients, [], 1, { fetch: spy, skipUsda: true });
    assert.equal(called, false);
  });

  it("labels the recipe method 'computed', never 'published'", async () => {
    const result = await computeNutrition([ing()], [], 1, { fetch: fakeUsda({}) });
    assert.equal(result.method, "computed");
  });

  it("divides the summed contributions by servings for perServing", async () => {
    const ingredients = [
      ing({ canonicalItem: "a", quantity: 1, unit: "g" }),
      ing({ canonicalItem: "b", quantity: 1, unit: "g" }),
    ];
    const guesses = [
      { canonicalItem: "a", contribution: { calories: 200, proteinGrams: 0, carbGrams: 0, fatGrams: 0, fiberGrams: 0, sodiumMg: 0 } },
      { canonicalItem: "b", contribution: { calories: 200, proteinGrams: 0, carbGrams: 0, fatGrams: 0, fiberGrams: 0, sodiumMg: 0 } },
    ];
    const result = await computeNutrition(ingredients, guesses, 4, { fetch: fakeUsda({}) });
    assert.equal(result.perServing.calories, 100);
  });

  it("produces exactly one row per ingredient, in order", async () => {
    const ingredients = [
      ing({ canonicalItem: "a" }),
      ing({ canonicalItem: "b" }),
      ing({ canonicalItem: "c" }),
    ];
    const result = await computeNutrition(ingredients, [], 1, { fetch: fakeUsda({}) });
    assert.deepEqual(result.perIngredient.map((i) => i.canonicalItem), ["a", "b", "c"]);
  });
});

describe("rescaleNutrition", () => {
  it("recomputes perServing without touching perIngredient or re-running any lookup", async () => {
    const ingredients = [ing({ canonicalItem: "flour", quantity: 1, unit: "g" })];
    const guesses = [{ canonicalItem: "flour", contribution: { calories: 400, proteinGrams: 0, carbGrams: 0, fatGrams: 0, fiberGrams: 0, sodiumMg: 0 } }];
    const original = await computeNutrition(ingredients, guesses, 2, { fetch: fakeUsda({}) });
    assert.equal(original.perServing.calories, 200);

    const rescaled = rescaleNutrition(original, 4);
    assert.equal(rescaled.perServing.calories, 100);
    assert.deepEqual(rescaled.perIngredient, original.perIngredient);
  });
});

describe("guessIngredientNutrition", () => {
  it("sends the product standard and discards invented or duplicate ingredient rows", async () => {
    let request: any;
    const audits: { validation: string }[] = [];
    const client = {
      messages: {
        parse: async (body: unknown) => {
          request = body;
          return {
            id: "msg_nutrition",
            model: "claude-opus-5",
            usage: { input_tokens: 10, output_tokens: 10 },
            parsed_output: {
              guesses: [
                { canonicalItem: "flour", calories: 100.14, proteinGrams: 2.22, carbGrams: 20, fatGrams: 1, fiberGrams: 1, sodiumMg: 2 },
                { canonicalItem: "flour", calories: 999, proteinGrams: 0, carbGrams: 0, fatGrams: 0, fiberGrams: 0, sodiumMg: 0 },
                { canonicalItem: "invented supplement", calories: 50, proteinGrams: 0, carbGrams: 0, fatGrams: 0, fiberGrams: 0, sodiumMg: 0 },
              ],
            },
          };
        },
      },
    } as unknown as Anthropic;
    const guesses = await guessIngredientNutrition([ing({ canonicalItem: "flour" })], {
      client,
      onGenerationAudit: (audit) => audits.push(audit),
    });
    assert.match(String(request.system), /sands-generated-content-v1/);
    assert.deepEqual(guesses.map((guess) => guess.canonicalItem), ["flour"]);
    assert.equal(guesses[0]!.contribution.calories, 100.1);
    assert.equal(audits[0]?.validation, "passed");
  });

  it("returns null-free guesses for every ingredient, via the real SDK against a stand-in", async () => {
    const { createServer } = await import("node:http");
    const AnthropicSdk = (await import("@anthropic-ai/sdk")).default;

    const server = createServer((req, res) => {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            id: "msg_test",
            type: "message",
            role: "assistant",
            model: "claude-opus-5",
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  guesses: [
                    { canonicalItem: "gochujang", calories: 45, proteinGrams: 1, carbGrams: 9, fatGrams: 0, fiberGrams: 0, sodiumMg: 800 },
                  ],
                }),
              },
            ],
            stop_reason: "end_turn",
            stop_sequence: null,
            usage: { input_tokens: 50, output_tokens: 50 },
          }),
        );
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const addr = server.address();
    const baseURL = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
    const client = new AnthropicSdk({ apiKey: "test-key", baseURL, maxRetries: 0 });

    const ingredients = [
      {
        raw: "1 tbsp gochujang", quantity: 1, quantityMax: null, unit: "tbsp",
        item: "gochujang", canonicalItem: "gochujang", notes: null, optional: false, group: null,
      },
    ];

    const guesses = await guessIngredientNutrition(ingredients, { client });
    server.close();

    assert.equal(guesses.length, 1);
    assert.equal(guesses[0]!.canonicalItem, "gochujang");
    assert.equal(guesses[0]!.contribution.sodiumMg, 800);
    // Every field is a plain number — the schema forbids null here on purpose.
    for (const v of Object.values(guesses[0]!.contribution)) assert.equal(typeof v, "number");
  });

  it("returns an empty list for an empty ingredient list, without a network call", async () => {
    const guesses = await guessIngredientNutrition([]);
    assert.deepEqual(guesses, []);
  });
});
