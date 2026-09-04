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

  it("doesn't flag a butter bean or butter lettuce as dairy — 'butter' names the food, not an ingredient in it", () => {
    assert.deepEqual(allergensIn("butter beans"), []);
    assert.deepEqual(allergensIn("butter bean"), []);
    assert.deepEqual(allergensIn("butter lettuce"), []);
  });

  it("still flags real butter even alongside a word from the non-dairy phrase list", () => {
    assert.deepEqual(allergensIn("unsalted butter"), ["milk"]);
    assert.deepEqual(allergensIn("butter, softened"), ["milk"]);
  });

  it("doesn't flag an ingredient explicitly labeled free of the allergen it would otherwise match", () => {
    assert.deepEqual(allergensIn("gluten-free bread"), []);
    assert.deepEqual(allergensIn("gluten-free flour"), []);
    assert.deepEqual(allergensIn("gluten free pasta"), []);
    assert.deepEqual(allergensIn("wheat-free flour"), []);
    assert.deepEqual(allergensIn("dairy-free cream cheese"), []);
    assert.deepEqual(allergensIn("non-dairy whipped cream"), []);
    assert.deepEqual(allergensIn("vegan cream cheese"), []);
    assert.deepEqual(allergensIn("peanut-free trail mix"), []);
    assert.deepEqual(allergensIn("soy-free tamari"), []);
    assert.deepEqual(allergensIn("sesame-free everything seasoning"), []);
    assert.deepEqual(allergensIn("fish-free worcestershire sauce"), []);
    assert.deepEqual(allergensIn("shellfish-free seafood seasoning"), []);
    assert.deepEqual(allergensIn("nut-free pesto"), []);
  });

  it("doesn't flag egg-free substitutes as eggs", () => {
    assert.deepEqual(allergensIn("egg replacer"), []);
    assert.deepEqual(allergensIn("egg substitute"), []);
    assert.deepEqual(allergensIn("flax egg"), []);
    assert.deepEqual(allergensIn("vegan egg"), []);
  });

  it("doesn't flag cream of tartar or cream soda as dairy — neither one contains any", () => {
    assert.deepEqual(allergensIn("cream of tartar"), []);
    assert.deepEqual(allergensIn("cream soda"), []);
  });

  it("treats 'vegan' as free-of for the four animal-derived allergens, but not for wheat, soy, peanuts, tree nuts, or sesame", () => {
    assert.deepEqual(allergensIn("vegan cream cheese"), []);
    assert.deepEqual(allergensIn("vegan egg"), []);
    assert.deepEqual(allergensIn("vegan fish sauce"), []);
    assert.deepEqual(allergensIn("vegan worcestershire sauce"), []);
    // "vegan" says nothing about these — a vegan diet can still include wheat,
    // soy, peanuts, tree nuts, and sesame.
    assert.deepEqual(allergensIn("vegan wheat bread"), ["wheat"]);
    assert.deepEqual(allergensIn("vegan soy sauce"), ["soy"]);
  });

  it("a 'free' or 'vegan' label doesn't blind it to a real allergen match elsewhere in the same ingredient", () => {
    // The label only cancels the allergen it names — a gluten-free product
    // can still contain milk, and vice versa.
    assert.deepEqual(allergensIn("gluten-free bread with milk powder"), ["milk"]);
    assert.deepEqual(allergensIn("vegan wheat bread"), ["wheat"]);
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

  it("doesn't flag an allergen word embedded inside an unrelated ingredient", () => {
    // A bare substring check would catch "egg" inside "eggplant" and "wheat"
    // inside "buckwheat" — real, common, unrelated ingredients.
    assert.deepEqual(allergensIn("eggplant"), []);
    assert.deepEqual(allergensIn("buckwheat flour"), []);
  });

  it("doesn't flag a plant milk as dairy just because it says 'milk'", () => {
    // Same false-positive shape as the butter case: the wrong warning here
    // is worse than a missed one.
    assert.deepEqual(allergensIn("coconut milk"), []);
    assert.deepEqual(allergensIn("almond milk"), ["tree-nuts"]);
    assert.deepEqual(allergensIn("oat milk"), []);
    assert.deepEqual(allergensIn("soy milk"), ["soy"]);
  });

  it("flags real milk even when the ingredient has other words around it", () => {
    assert.deepEqual(allergensIn("whole milk"), ["milk"]);
  });

  it("flags a shellfish ingredient as shellfish, not just fish", () => {
    // "shellfish" contains "fish" as a substring, which a naive check would
    // catch instead of (or as well as) the actual allergen.
    assert.deepEqual(allergensIn("mixed shellfish"), ["shellfish"]);
    assert.deepEqual(allergensIn("shellfish stock"), ["shellfish"]);
  });

  it("still flags real fish on its own", () => {
    assert.deepEqual(allergensIn("cod"), ["fish"]);
    assert.deepEqual(allergensIn("fish sauce"), ["fish"]);
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
