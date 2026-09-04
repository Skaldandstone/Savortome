import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gzipSync } from "node:zlib";
import { parsePaprikaExport } from "../src/importers/paprika.js";

/**
 * A minimal stored-entry (uncompressed) zip writer — just enough to build the
 * `.paprikarecipes` fixtures these tests need. Paprika's own exports always
 * use stored entries too (the gzip layer inside each one does the actual
 * compressing), so this exercises the reader the same way a real export does.
 */
function buildZip(entries: { name: string; data: Buffer }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, "utf8");

    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // method: stored
    local.writeUInt16LE(0, 10); // mod time
    local.writeUInt16LE(0, 12); // mod date
    local.writeUInt32LE(0, 14); // crc32 (unchecked by our reader)
    local.writeUInt32LE(data.length, 18); // compressed size
    local.writeUInt32LE(data.length, 22); // uncompressed size
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // extra length
    nameBuf.copy(local, 30);
    locals.push(local, data);

    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8); // flags
    central.writeUInt16LE(0, 10); // method
    central.writeUInt16LE(0, 12); // mod time
    central.writeUInt16LE(0, 14); // mod date
    central.writeUInt32LE(0, 16); // crc32
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30); // extra length
    central.writeUInt16LE(0, 32); // comment length
    central.writeUInt16LE(0, 34); // disk number
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE(0, 38); // external attrs
    central.writeUInt32LE(offset, 42); // local header offset
    nameBuf.copy(central, 46);
    centrals.push(central);

    offset += local.length + data.length;
  }

  const centralDir = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, centralDir, eocd]);
}

const gzipRecipeEntry = (name: string, json: unknown) => ({ name, data: gzipSync(Buffer.from(JSON.stringify(json))) });

const chili = {
  name: "Weeknight Chili",
  description: "A fast chili.",
  notes: "Great with cornbread.",
  ingredients: "For the base:\n1 tablespoon olive oil\n1 large yellow onion, diced\n2 (14.5 oz) cans diced tomatoes",
  directions: "Heat the oil in a Dutch oven.\n\nAdd the onion and cook for 5 minutes.\n\nAdd tomatoes and simmer.",
  prep_time: "15 min",
  cook_time: "1 h 20 min",
  servings: "6 servings",
  difficulty: "Easy",
  categories: ["Dinner", "Freezer-Friendly"],
  source: "Sam Cook",
  source_url: "https://example.com/chili",
};

describe("parsePaprikaExport", () => {
  it("reads a recipe's fields out of a stored-entry zip of gzip'd JSON", () => {
    const zip = buildZip([gzipRecipeEntry("abc123.paprikarecipe", chili)]);
    const { items, skipped } = parsePaprikaExport(zip);

    assert.equal(skipped.length, 0);
    assert.equal(items.length, 1);
    const { recipe, sourceUrl, author } = items[0]!;
    assert.equal(recipe.title, "Weeknight Chili");
    assert.equal(recipe.description, "A fast chili.\n\nGreat with cornbread.");
    assert.equal(recipe.prepMinutes, 15);
    assert.equal(recipe.cookMinutes, 80);
    assert.equal(recipe.totalMinutes, 95);
    assert.equal(recipe.servings, 6);
    assert.equal(recipe.servingsNote, "6 servings");
    assert.equal(recipe.difficulty, "easy");
    assert.deepEqual(recipe.tags, ["dinner", "freezer-friendly"]);
    assert.equal(sourceUrl, "https://example.com/chili");
    assert.equal(author, "Sam Cook");
    assert.equal(recipe.confidence, 1);
  });

  it("splits the ingredient block on a group header line", () => {
    const zip = buildZip([gzipRecipeEntry("abc123.paprikarecipe", chili)]);
    const { items } = parsePaprikaExport(zip);
    const { ingredients } = items[0]!.recipe;

    assert.equal(ingredients.length, 3);
    assert.equal(ingredients[0]!.group, "For the base");
    assert.equal(ingredients[1]!.group, "For the base");
    assert.equal(ingredients[1]!.canonicalItem, "yellow onion");
    assert.equal(ingredients[2]!.canonicalItem, "tomato");
  });

  it("recognizes a group header even when it contains a digit", () => {
    // A digit exclusion here would treat "For the 2 sauces:" as an
    // ingredient line instead of a heading, garbling it through
    // parseIngredientLine and losing the group for everything under it —
    // the same convention the recipe editor uses (editor.ts's
    // isGroupHeading) has no such exclusion.
    const zip = buildZip([
      gzipRecipeEntry("abc123.paprikarecipe", {
        ...chili,
        ingredients: "For the 2 sauces:\n1 cup mayonnaise\n2 tbsp hot sauce",
      }),
    ]);
    const { items } = parsePaprikaExport(zip);
    const { ingredients } = items[0]!.recipe;

    assert.equal(ingredients.length, 2);
    assert.equal(ingredients[0]!.group, "For the 2 sauces");
    assert.equal(ingredients[1]!.group, "For the 2 sauces");
  });

  it("splits directions into steps on blank lines", () => {
    const zip = buildZip([gzipRecipeEntry("abc123.paprikarecipe", chili)]);
    const { items } = parsePaprikaExport(zip);
    assert.equal(items[0]!.recipe.steps.length, 3);
    assert.equal(items[0]!.recipe.steps[1]!.text, "Add the onion and cook for 5 minutes.");
  });

  it("reads every recipe in a multi-entry export", () => {
    const zip = buildZip([
      gzipRecipeEntry("a.paprikarecipe", chili),
      gzipRecipeEntry("b.paprikarecipe", { ...chili, name: "Sunday Roast" }),
    ]);
    const { items } = parsePaprikaExport(zip);
    assert.deepEqual(
      items.map((i) => i.recipe.title),
      ["Weeknight Chili", "Sunday Roast"],
    );
  });

  it("skips an entry that's missing a name, ingredients, or steps instead of failing the whole import", () => {
    const zip = buildZip([
      gzipRecipeEntry("good.paprikarecipe", chili),
      gzipRecipeEntry("bad.paprikarecipe", { name: "Untitled", ingredients: "", directions: "" }),
    ]);
    const { items, skipped } = parsePaprikaExport(zip);
    assert.equal(items.length, 1);
    assert.deepEqual(skipped, ["bad.paprikarecipe"]);
  });

  it("skips an entry whose payload isn't valid gzip'd JSON", () => {
    const zip = buildZip([
      gzipRecipeEntry("good.paprikarecipe", chili),
      { name: "corrupt.paprikarecipe", data: Buffer.from("not gzip data") },
    ]);
    const { items, skipped } = parsePaprikaExport(zip);
    assert.equal(items.length, 1);
    assert.deepEqual(skipped, ["corrupt.paprikarecipe"]);
  });

  it("ignores non-.paprikarecipe entries (photos, metadata) without erroring", () => {
    const zip = buildZip([
      gzipRecipeEntry("recipe.paprikarecipe", chili),
      { name: "photo.jpg", data: Buffer.from([0xff, 0xd8, 0xff]) },
    ]);
    const { items, skipped } = parsePaprikaExport(zip);
    assert.equal(items.length, 1);
    assert.equal(skipped.length, 0);
  });

  it("rejects a file that isn't a zip at all", () => {
    assert.throws(() => parsePaprikaExport(Buffer.from("just some text")), /doesn't look like a Paprika export/);
  });

  it("rejects a valid zip with no recipe entries", () => {
    const zip = buildZip([{ name: "readme.txt", data: Buffer.from("hi") }]);
    assert.throws(() => parsePaprikaExport(zip), /didn't contain any recipes/);
  });
});
