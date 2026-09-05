import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aisleFor, groupByAisle } from "../src/aisles.js";

/** Read as: this ingredient belongs in this part of the shop. */
const shelves: [string, string][] = [
  ["yellow onion", "produce"],
  ["garlic", "produce"],
  ["lemon", "produce"],
  ["flat leaf parsley", "produce"],
  ["chicken thigh", "meat"],
  ["streaky bacon", "meat"],
  ["salmon fillet", "meat"],
  ["whole milk", "dairy"],
  ["unsalted butter", "dairy"],
  ["greek yogurt", "dairy"],
  ["firm tofu", "dairy"],
  ["sourdough bread", "bakery"],
  ["frozen pea", "frozen"],
  ["olive oil", "pantry"],
  ["plain flour", "pantry"],
  ["soy sauce", "pantry"],
  ["gochujang", "pantry"],
  ["red wine", "drinks"],
  ["quinoa", "pantry"],
  ["nduja", "other"],
];

describe("aisleFor", () => {
  for (const [item, aisle] of shelves) {
    it(`puts ${item} in ${aisle}`, () => {
      assert.equal(aisleFor(item), aisle);
    });
  }

  it("matches whole words, never substrings", () => {
    // The whole reason this isn't a substring table: each of these contains a
    // word that would file it in the wrong half of the shop.
    assert.equal(aisleFor("grapeseed oil"), "pantry", "not produce, via 'grape'");
    assert.equal(aisleFor("cream of tartar"), "pantry", "not dairy, via 'cream'");
    assert.equal(aisleFor("buttermilk pancake mix"), "dairy");
    assert.equal(aisleFor("peanut butter"), "pantry", "not dairy, via 'butter'");
  });

  it("prefers the shelf-stable reading when a word could go either way", () => {
    // A tin of tomatoes lives in the middle aisles; the vegetable doesn't.
    assert.equal(aisleFor("canned tomato"), "pantry");
    assert.equal(aisleFor("tomato"), "produce");
    assert.equal(aisleFor("coconut milk"), "pantry");
    assert.equal(aisleFor("almond"), "pantry");
  });

  it("reads the shopper's own wording too, not just the canonical name", () => {
    // The canonicalizer strips "frozen" as prep, so the canonical name alone
    // would file a bag of frozen peas in produce.
    assert.equal(aisleFor("pea"), "produce");
    assert.equal(aisleFor("pea", "frozen peas"), "frozen");
    assert.equal(aisleFor("berry", "frozen mixed berries"), "frozen");
  });

  it("tells a fresh vegetable from a pantry word that happens to share its name", () => {
    // "pepper" alone has to mean the spice (or "black pepper" and "pepper
    // flakes" would land in produce), and "bean" alone has to mean canned or
    // dried (or "black bean" and "kidney bean" would too) — but a qualifier
    // that only ever means the fresh vegetable should win over that default.
    assert.equal(aisleFor("bell pepper"), "produce");
    assert.equal(aisleFor("red bell pepper"), "produce");
    assert.equal(aisleFor("green bean"), "produce");
    assert.equal(aisleFor("string bean"), "produce");
    assert.equal(aisleFor("runner bean"), "produce");
    // The qualifier has to actually be there — bare "pepper" and "bean" keep
    // defaulting to pantry.
    assert.equal(aisleFor("black pepper"), "pantry");
    assert.equal(aisleFor("pepper"), "pantry");
    assert.equal(aisleFor("kidney bean"), "pantry");
    assert.equal(aisleFor("bean"), "pantry");
  });

  it("knows the dry goods that aren't flour or rice", () => {
    for (const item of ["cornmeal", "polenta", "couscous", "quinoa", "granola", "turmeric"]) {
      assert.equal(aisleFor(item), "pantry", `${item} belongs in the pantry`);
    }
  });

  it("falls back rather than guessing", () => {
    // An unknown item at the end of the list is a small annoyance. The same
    // item confidently filed under Frozen is a walk to the wrong aisle.
    assert.equal(aisleFor("sumac"), "other");
    assert.equal(aisleFor(""), "other");
    assert.equal(aisleFor("   "), "other");
  });
});

describe("groupByAisle", () => {
  const line = (canonicalItem: string) => ({ canonicalItem });

  it("returns sections in walking order, fresh edges first", () => {
    const groups = groupByAisle([line("olive oil"), line("onion"), line("chicken breast")]);
    assert.deepEqual(groups.map((g) => g.aisle), ["produce", "meat", "pantry"]);
  });

  it("drops empty sections rather than printing bare headings", () => {
    const groups = groupByAisle([line("onion")]);
    assert.equal(groups.length, 1);
    assert.equal(groups[0]!.label, "Produce");
  });

  it("keeps everything, including what it couldn't place", () => {
    const lines = [line("onion"), line("sumac"), line("milk")];
    const total = groupByAisle(lines).reduce((n, g) => n + g.items.length, 0);
    assert.equal(total, lines.length);
    assert.equal(groupByAisle(lines).at(-1)!.aisle, "other");
  });

  it("has nothing to group when the list is empty", () => {
    assert.deepEqual(groupByAisle([]), []);
  });
});
