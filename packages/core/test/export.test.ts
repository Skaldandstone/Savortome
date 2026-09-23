import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EXPORT_VERSION,
  buildArchive,
  exportFilename,
  groupIngredients,
  ingredientLine,
  recipeToMarkdown,
  recipeToText,
} from "../src/export.js";
import type { Ingredient, Recipe } from "../src/recipe.js";

const ingredient = (over: Partial<Ingredient>): Ingredient => ({
  raw: "",
  quantity: null,
  quantityMax: null,
  unit: null,
  item: "thing",
  canonicalItem: "thing",
  notes: null,
  optional: false,
  group: null,
  ...over,
});

const recipe = (over: Partial<Recipe> = {}): Recipe => ({
  id: "r1",
  title: "Kimchi stew",
  description: "A pot of it, in twenty minutes.",
  photos: [],
  servings: 2,
  servingsNote: null,
  prepMinutes: 5,
  cookMinutes: 15,
  totalMinutes: 20,
  ingredients: [
    ingredient({ quantity: 1, unit: "cup", item: "kimchi", canonicalItem: "kimchi" }),
    ingredient({ quantity: 1, unit: "tbsp", item: "gochujang", canonicalItem: "gochujang" }),
  ],
  steps: [
    { n: 1, text: "Fry the kimchi.", timerSeconds: null, sourceTimestamp: null },
    { n: 2, text: "Add stock and simmer.", timerSeconds: 600, sourceTimestamp: null },
  ],
  equipment: [],
  tags: [],
  cuisine: null,
  course: null,
  difficulty: null,
  skillDemands: null,
  confidence: 1,
  extractionNotes: [],
  imageUrl: null,
  source: {
    kind: "manual",
    url: null,
    author: null,
    siteName: null,
    extractionMethod: "manual",
  },
  ...over,
});

describe("ingredientLine", () => {
  it("puts the amount, the thing, and the prep in one line", () => {
    assert.equal(
      ingredientLine(
        ingredient({ quantity: 1, unit: "tbsp", item: "olive oil", notes: "finely chopped" }),
      ),
      "1 tbsp olive oil, finely chopped",
    );
  });

  it("says when something is optional, because that's the point of the flag", () => {
    assert.equal(
      ingredientLine(ingredient({ item: "chilli flakes", optional: true })),
      "chilli flakes (optional)",
    );
  });

  it("copes with no amount at all", () => {
    assert.equal(ingredientLine(ingredient({ item: "salt" })), "salt");
  });

  it("keeps a range as a range rather than picking one end", () => {
    assert.equal(
      ingredientLine(ingredient({ quantity: 2, quantityMax: 3, unit: "clove", item: "garlic" })),
      "2-3 clove garlic",
    );
  });

  it("falls back to the raw line when the item was never separated out", () => {
    assert.equal(ingredientLine(ingredient({ item: "", raw: "a good splash of something" })), "a good splash of something");
  });
});

describe("groupIngredients", () => {
  it("keeps sub-recipes in the order the cook meets them", () => {
    const groups = groupIngredients([
      ingredient({ item: "flour", group: "For the base" }),
      ingredient({ item: "tomato", group: "For the sauce" }),
      ingredient({ item: "water", group: "For the base" }),
    ]);

    assert.deepEqual(
      groups.map((g) => g.group),
      ["For the base", "For the sauce"],
    );
    // The second "For the base" line rejoins its own group rather than opening
    // a third one.
    assert.deepEqual(groups[0]!.ingredients.map((i) => i.item), ["flour", "water"]);
  });

  it("treats an ungrouped list as one nameless group", () => {
    const groups = groupIngredients([ingredient({}), ingredient({})]);
    assert.equal(groups.length, 1);
    assert.equal(groups[0]!.group, null);
  });
});

describe("recipeToMarkdown", () => {
  it("writes a recipe someone could actually cook from", () => {
    const md = recipeToMarkdown(recipe());
    assert.match(md, /^# Kimchi stew/);
    assert.match(md, /## Ingredients/);
    assert.match(md, /- 1 cup kimchi/);
    assert.match(md, /## Method/);
    assert.match(md, /1\. Fry the kimchi\./);
    assert.match(md, /2\. Add stock and simmer\./);
  });

  it("numbers steps by position, not by whatever n says", () => {
    // Step numbers survive editing and reordering; the list a person reads
    // must count 1, 2, 3 regardless.
    const md = recipeToMarkdown(
      recipe({
        steps: [
          { n: 7, text: "First.", timerSeconds: null, sourceTimestamp: null },
          { n: 9, text: "Second.", timerSeconds: null, sourceTimestamp: null },
        ],
      }),
    );
    assert.match(md, /1\. First\./);
    assert.match(md, /2\. Second\./);
  });

  it("credits the source, with the link, when there is one", () => {
    const md = recipeToMarkdown(
      recipe({
        source: {
          kind: "youtube",
          url: "https://youtu.be/abc",
          author: "Maangchi",
          siteName: null,
          extractionMethod: "transcript-llm",
        },
      }),
    );
    assert.match(md, /Source: Maangchi — https:\/\/youtu\.be\/abc/);
  });

  it("says nothing about a source for something typed by hand", () => {
    assert.doesNotMatch(recipeToMarkdown(recipe()), /Source:/);
  });

  it("exports what's on screen, so a doubled recipe exports doubled", () => {
    const md = recipeToMarkdown(recipe(), {
      ingredients: [ingredient({ quantity: 2, unit: "cup", item: "kimchi" })],
      servings: 4,
    });
    assert.match(md, /- 2 cup kimchi/);
    assert.match(md, /Serves 4/);
  });

  it("leaves out sections a recipe doesn't have rather than printing empty ones", () => {
    const md = recipeToMarkdown(recipe({ equipment: [], tags: [], description: null }));
    assert.doesNotMatch(md, /## Equipment/);
    assert.doesNotMatch(md, /Tags:/);
  });

  it("ends with exactly one newline, however much was trimmed", () => {
    const md = recipeToMarkdown(recipe({ equipment: [], tags: [] }));
    assert.ok(md.endsWith("\n"));
    assert.ok(!md.endsWith("\n\n"));
  });
});

describe("recipeToText", () => {
  it("uses underlines and plain lists, not markdown with the syntax showing", () => {
    const text = recipeToText(recipe());
    assert.match(text, /^Kimchi stew\n===========/);
    assert.doesNotMatch(text, /^#/m);
    assert.doesNotMatch(text, /^- /m);
  });

  it("keeps sub-recipe headings, since they're what makes a long list readable", () => {
    const text = recipeToText(
      recipe({
        ingredients: [ingredient({ item: "flour", group: "For the base" })],
      }),
    );
    assert.match(text, /For the base:/);
  });
});

describe("exportFilename", () => {
  it("makes something a filesystem will accept", () => {
    assert.equal(exportFilename('Grandma’s "Best" Pie/Tart', "md"), "grandmas-best-pie-tart.md");
  });

  it("doesn't leave a dash dangling at either end", () => {
    assert.equal(exportFilename("  Soup!  ", "txt"), "soup.txt");
  });

  it("still returns a name when the title is all punctuation", () => {
    assert.equal(exportFilename("!!!", "json"), "recipe.json");
  });

  it("keeps the name short enough to survive a download folder", () => {
    const name = exportFilename("a".repeat(200), "md");
    assert.equal(name, `${"a".repeat(60)}.md`);
  });
});

describe("buildArchive", () => {
  it("stamps the file with what it is, so it can be read back later", () => {
    const archive = buildArchive([recipe()], new Date("2026-08-26T10:00:00Z"));
    assert.equal(archive.format, "savortome-recipes");
    assert.equal(archive.version, EXPORT_VERSION);
    assert.equal(archive.exportedAt, "2026-08-26T10:00:00.000Z");
    assert.equal(archive.count, 1);
  });

  it("copies the list rather than holding on to the caller's array", () => {
    const recipes = [recipe()];
    const archive = buildArchive(recipes);
    recipes.push(recipe({ id: "r2" }));
    assert.equal(archive.recipes.length, 1);
  });

  it("survives an empty library", () => {
    assert.deepEqual(buildArchive([]).recipes, []);
  });
});
