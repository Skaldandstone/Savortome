import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractJsonLdRecipe, isoDurationToMinutes } from "../src/sources/jsonld.js";
import { timerFromStep } from "../src/cook.js";

/** A page shaped like the recipe-card plugins most food blogs actually ship. */
const page = (recipe: unknown) => `<!doctype html>
<html><head>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite"}</script>
<script type="application/ld+json">${JSON.stringify(recipe)}</script>
</head><body><p>life story</p></body></html>`;

const baseRecipe = {
  "@context": "https://schema.org",
  "@type": ["Recipe"],
  name: "Weeknight Chili",
  description: "A fast chili.",
  recipeYield: ["6", "6 servings"],
  prepTime: "PT15M",
  cookTime: "PT45M",
  recipeCuisine: "American",
  recipeCategory: "Dinner",
  keywords: "chili, one-pot, freezer-friendly",
  image: [{ "@type": "ImageObject", url: "https://example.com/chili.jpg" }],
  author: { "@type": "Person", name: "Sam Cook" },
  recipeIngredient: [
    "1 tablespoon olive oil",
    "1 large yellow onion, diced",
    "2 (14.5 oz) cans diced tomatoes",
    "&frac12; teaspoon smoked paprika",
    "Salt and pepper to taste",
  ],
  recipeInstructions: [
    { "@type": "HowToStep", text: "Heat the oil in a Dutch oven over medium heat." },
    { "@type": "HowToStep", text: "Add the onion and cook for 5 minutes until soft." },
    { "@type": "HowToStep", text: "Add tomatoes and simmer for 30 to 40 minutes." },
  ],
};

describe("extractJsonLdRecipe", () => {
  it("pulls a recipe out of a page with several JSON-LD blocks", () => {
    const got = extractJsonLdRecipe(page(baseRecipe));
    assert.ok(got);
    assert.equal(got.recipe.title, "Weeknight Chili");
    assert.equal(got.recipe.ingredients.length, 5);
    assert.equal(got.recipe.steps.length, 3);
    assert.equal(got.author, "Sam Cook");
    assert.equal(got.imageUrl, "https://example.com/chili.jpg");
  });

  it("reads times and derives a total when only prep and cook are given", () => {
    const got = extractJsonLdRecipe(page(baseRecipe))!;
    assert.equal(got.recipe.prepMinutes, 15);
    assert.equal(got.recipe.cookMinutes, 45);
    assert.equal(got.recipe.totalMinutes, 60);
  });

  it("picks the descriptive yield instead of concatenating the array", () => {
    const got = extractJsonLdRecipe(page(baseRecipe))!;
    assert.equal(got.recipe.servings, 6);
    assert.equal(got.recipe.servingsNote, "6 servings");
  });

  it("decodes HTML entities so quantities still parse", () => {
    const got = extractJsonLdRecipe(page(baseRecipe))!;
    const paprika = got.recipe.ingredients.find((i) => i.canonicalItem.includes("paprika"));
    assert.ok(paprika);
    assert.equal(paprika.quantity, 0.5);
    assert.equal(paprika.unit, "tsp");
  });

  it("reports parse coverage so the caller can fall back to the model", () => {
    const got = extractJsonLdRecipe(page(baseRecipe))!;
    // Four of five lines carry an amount; "Salt and pepper to taste" does not.
    assert.equal(got.parseCoverage, 0.8);
  });

  it("finds a recipe nested inside @graph", () => {
    const got = extractJsonLdRecipe(
      page({ "@context": "https://schema.org", "@graph": [{ "@type": "Person" }, baseRecipe] }),
    );
    assert.ok(got);
    assert.equal(got.recipe.title, "Weeknight Chili");
  });

  it("flattens HowToSection groups into a flat step list", () => {
    const got = extractJsonLdRecipe(
      page({
        ...baseRecipe,
        recipeInstructions: [
          {
            "@type": "HowToSection",
            name: "For the base",
            itemListElement: [
              { "@type": "HowToStep", text: "Chop everything." },
              { "@type": "HowToStep", text: "Brown the beef." },
            ],
          },
          { "@type": "HowToStep", text: "Simmer." },
        ],
      }),
    )!;
    assert.deepEqual(
      got.recipe.steps.map((s) => s.text),
      ["Chop everything.", "Brown the beef.", "Simmer."],
    );
    assert.deepEqual(
      got.recipe.steps.map((s) => s.n),
      [1, 2, 3],
    );
  });

  it("returns null for a page with no recipe", () => {
    assert.equal(extractJsonLdRecipe("<html><body>no recipe here</body></html>"), null);
  });

  it("survives a malformed JSON-LD block and reads the next one", () => {
    const html = `<html><head>
      <script type="application/ld+json">{ not json }</script>
      <script type="application/ld+json">${JSON.stringify(baseRecipe)}</script>
      </head><body></body></html>`;
    assert.ok(extractJsonLdRecipe(html));
  });

  it("rejects a Recipe node missing ingredients or steps", () => {
    assert.equal(extractJsonLdRecipe(page({ ...baseRecipe, recipeInstructions: [] })), null);
  });
});

describe("isoDurationToMinutes", () => {
  it("parses ISO-8601 durations", () => {
    assert.equal(isoDurationToMinutes("PT1H15M"), 75);
    assert.equal(isoDurationToMinutes("PT30M"), 30);
    assert.equal(isoDurationToMinutes("P1DT2H"), 1560);
  });

  it("falls back to plain-language durations", () => {
    assert.equal(isoDurationToMinutes("45 minutes"), 45);
    assert.equal(isoDurationToMinutes("2 hours"), 120);
  });

  it("returns null for junk", () => {
    assert.equal(isoDurationToMinutes("a while"), null);
    assert.equal(isoDurationToMinutes(undefined), null);
  });
});

describe("timerFromStep", () => {
  it("takes the midpoint of a range", () => {
    assert.equal(timerFromStep("Simmer for 30 to 40 minutes."), 2100);
  });

  it("handles single durations and sub-minute times", () => {
    assert.equal(timerFromStep("Cook for 5 minutes until soft."), 300);
    assert.equal(timerFromStep("Microwave for about 10 seconds."), 10);
  });

  it("returns null when no duration is mentioned", () => {
    assert.equal(timerFromStep("Season to taste and serve."), null);
  });
});

describe("serving counts", () => {
  const withYield = (recipeYield: unknown) =>
    extractJsonLdRecipe(page({ ...baseRecipe, recipeYield }))!.recipe;

  it("reads per-person yields as a serving count", () => {
    assert.equal(withYield("4").servings, 4);
    assert.equal(withYield("6 servings").servings, 6);
    assert.equal(withYield("about 8 servings").servings, 8);
    // A range scales from its low end.
    assert.equal(withYield("serves 4-6").servings, 4);
  });

  it("leaves item yields unscaled so the UI never says '1 serving' for a loaf", () => {
    assert.equal(withYield(["1", "1 loaf"]).servings, null);
    assert.equal(withYield("24 cookies").servings, null);
    assert.equal(withYield("2 dozen").servings, null);
  });

  it("always keeps the source's own wording", () => {
    assert.equal(withYield(["1", "1 loaf"]).servingsNote, "1 loaf");
    assert.equal(withYield("serves 4-6").servingsNote, "serves 4-6");
  });
});
