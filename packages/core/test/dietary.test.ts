import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { allergensIn, flagsForRecipe, type Allergen } from "../src/dietary.js";

describe("allergensIn", () => {
  it("matches an exact allergen name", () => {
    assert.deepEqual(allergensIn("peanut"), ["peanuts"]);
  });

  it("matches a specific product containing the allergen word", () => {
    assert.ok(allergensIn("cheddar cheese").includes("milk"));
    assert.ok(allergensIn("all purpose flour").includes("wheat"));
  });

  it("flags real dairy butter as milk", () => {
    assert.deepEqual(allergensIn("unsalted butter"), ["milk"]);
  });

  it("doesn't flag a nut or fruit butter as dairy just because it says 'butter'", () => {
    // Peanut butter is dairy-free; the wrong warning here is worse than a
    // missed one, since it teaches someone to stop trusting the flag at all.
    assert.deepEqual(allergensIn("peanut butter"), ["peanuts"]);
    assert.deepEqual(allergensIn("almond butter"), ["tree-nuts"]);
    assert.deepEqual(allergensIn("cocoa butter"), []);
  });

  it("can match more than one allergen in a single ingredient", () => {
    // Contrived, but the point is the function doesn't stop at the first hit.
    const flagged = allergensIn("sesame tahini");
    assert.ok(flagged.includes("sesame"));
  });

  it("returns nothing for an ingredient with no known allergen", () => {
    assert.deepEqual(allergensIn("carrot"), []);
  });

  it("is case-insensitive", () => {
    assert.deepEqual(allergensIn("PEANUT"), ["peanuts"]);
  });

  it("distinguishes tree nuts from peanuts", () => {
    assert.deepEqual(allergensIn("almond"), ["tree-nuts"]);
    assert.deepEqual(allergensIn("peanut"), ["peanuts"]);
  });
});

describe("flagsForRecipe", () => {
  const ing = (canonicalItem: string, optional = false) => ({ canonicalItem, optional });

  it("returns nothing when the viewer has no allergens flagged", () => {
    assert.deepEqual(flagsForRecipe([ing("peanut")], []), []);
  });

  it("flags a matching ingredient the viewer is watching for", () => {
    const flags = flagsForRecipe([ing("peanut oil"), ing("carrot")], ["peanuts"]);
    assert.equal(flags.length, 1);
    assert.equal(flags[0]?.canonicalItem, "peanut oil");
    assert.equal(flags[0]?.allergen, "peanuts");
  });

  it("ignores an allergen present in the recipe that the viewer isn't watching for", () => {
    const flags = flagsForRecipe([ing("shrimp")], ["peanuts"]);
    assert.deepEqual(flags, []);
  });

  it("carries whether the flagged ingredient was optional", () => {
    const flags = flagsForRecipe([ing("peanut", true)], ["peanuts"]);
    assert.equal(flags[0]?.optional, true);
  });

  it("flags every matching ingredient, not just the first", () => {
    const flags = flagsForRecipe([ing("milk"), ing("butter")], ["milk"]);
    assert.equal(flags.length, 2);
  });

  it("watches for several allergens at once", () => {
    const watching: Allergen[] = ["milk", "peanuts"];
    const flags = flagsForRecipe([ing("milk"), ing("peanut"), ing("carrot")], watching);
    assert.deepEqual(
      flags.map((f) => f.allergen).sort(),
      ["milk", "peanuts"],
    );
  });
});
