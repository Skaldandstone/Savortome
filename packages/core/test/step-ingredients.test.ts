import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ingredientsByStep, ingredientsForStep } from "../src/step-ingredients.js";
import type { Ingredient, Step } from "../src/recipe.js";

const ing = (canonical: string, over: Partial<Ingredient> = {}): Ingredient => ({
  raw: canonical,
  quantity: 1,
  quantityMax: null,
  unit: "cup",
  item: canonical,
  canonicalItem: canonical,
  notes: null,
  optional: false,
  group: null,
  ...over,
});

const step = (text: string, n = 1): Step => ({
  n,
  text,
  timerSeconds: null,
  sourceTimestamp: null,
});

const names = (found: Ingredient[]) => found.map((i) => i.canonicalItem);

describe("ingredientsForStep", () => {
  it("finds what a step names outright", () => {
    const list = [ing("flour"), ing("sugar"), ing("egg")];
    assert.deepEqual(names(ingredientsForStep(step("Whisk the flour and sugar."), list)), [
      "flour",
      "sugar",
    ]);
  });

  it("survives the plural, because steps rarely say 'egg'", () => {
    assert.deepEqual(names(ingredientsForStep(step("Beat the eggs."), [ing("egg")])), ["egg"]);
    assert.deepEqual(names(ingredientsForStep(step("Halve the tomatoes."), [ing("tomato")])), [
      "tomato",
    ]);
    assert.deepEqual(names(ingredientsForStep(step("Slice the anchovies."), [ing("anchovy")])), [
      "anchovy",
    ]);
  });

  it("returns them in recipe order, not order of mention", () => {
    // The amounts read as a checklist beside the step, and a checklist should
    // match the list it came from.
    const list = [ing("flour"), ing("sugar"), ing("butter")];
    assert.deepEqual(names(ingredientsForStep(step("Cream the butter and sugar."), list)), [
      "sugar",
      "butter",
    ]);
  });

  it("matches whole words, never substrings", () => {
    // "oat" inside "coat", and "ice" inside "slice", are the classic way this
    // kind of matching goes quietly wrong.
    assert.deepEqual(ingredientsForStep(step("Coat the pan."), [ing("oat")]), []);
    assert.deepEqual(ingredientsForStep(step("Slice thinly."), [ing("ice")]), []);
    assert.deepEqual(ingredientsForStep(step("Butter the dish."), [ing("butter")]).length, 1);
  });

  it("resolves the shorthand a step actually uses", () => {
    // Having said "olive oil" in the list, a step says "the oil".
    const list = [ing("olive oil"), ing("flour")];
    assert.deepEqual(names(ingredientsForStep(step("Heat the oil."), list)), ["olive oil"]);
  });

  it("refuses the shorthand when two things could be meant", () => {
    // With two oils in the recipe, "the oil" is genuinely ambiguous. No amount
    // sends the cook to the ingredient list; a wrong one sends them to the bin.
    const list = [ing("olive oil"), ing("sesame oil")];
    assert.deepEqual(ingredientsForStep(step("Heat the oil."), list), []);
  });

  it("still matches the full name when the shorthand is ambiguous", () => {
    const list = [ing("olive oil"), ing("sesame oil")];
    assert.deepEqual(names(ingredientsForStep(step("Add the sesame oil."), list)), ["sesame oil"]);
  });

  it("matches a multi-word name as a phrase, not as loose words", () => {
    // Both words of "brown sugar" appear here, scattered. Two sugars in the
    // recipe means the shorthand can't rescue it either, so nothing matches —
    // which is the point: the words have to be adjacent to be the name.
    const two = [ing("brown sugar"), ing("icing sugar")];
    assert.deepEqual(ingredientsForStep(step("Brown the meat, then add sugar."), two), []);
    assert.deepEqual(names(ingredientsForStep(step("Add the brown sugar."), two)), ["brown sugar"]);
  });

  it("does read a bare head noun as the only thing it could be", () => {
    // With one sugar in the recipe, "add sugar" is that sugar. This is the
    // same rule as "the oil", and it's why the test above needs two sugars.
    const one = [ing("brown sugar")];
    assert.deepEqual(names(ingredientsForStep(step("Then add sugar."), one)), ["brown sugar"]);
  });

  it("doesn't let a short name claim a mention a longer one covers", () => {
    // Found on a real recipe: with both garlic and garlic powder in the list,
    // "season with garlic powder" also matched the bare garlic, and the cook
    // would be told to add a clove that isn't wanted yet.
    const list = [ing("garlic"), ing("garlic powder")];
    assert.deepEqual(names(ingredientsForStep(step("Season with garlic powder."), list)), [
      "garlic powder",
    ]);
  });

  it("...but keeps the short one when it also stands on its own", () => {
    const list = [ing("garlic"), ing("garlic powder")];
    assert.deepEqual(
      names(ingredientsForStep(step("Crush the garlic, then add garlic powder."), list)),
      ["garlic", "garlic powder"],
    );
  });

  it("won't resolve shorthand to something a recipe makes for itself", () => {
    // Found on a real recipe: "fold the tofu into the sauce" means the dressing
    // made two steps earlier, not the bottle of hot sauce in the list.
    const list = [ing("hot sauce"), ing("tofu")];
    assert.deepEqual(names(ingredientsForStep(step("Fold the tofu into the sauce."), list)), [
      "tofu",
    ]);
    // Saying it outright still works.
    assert.deepEqual(names(ingredientsForStep(step("Add a dash of hot sauce."), list)), [
      "hot sauce",
    ]);
  });

  it("takes the shorthand from either half when the tail is a form word", () => {
    // "olive oil" becomes "the oil", but "vanilla extract" becomes "vanilla" —
    // an extract is still the thing it's an extract of.
    const list = [ing("vanilla extract"), ing("olive oil")];
    assert.deepEqual(names(ingredientsForStep(step("Stir in the vanilla."), list)), [
      "vanilla extract",
    ]);
    assert.deepEqual(names(ingredientsForStep(step("Heat the oil."), list)), ["olive oil"]);
  });

  it("won't let an adjective stand for the whole name", () => {
    // "Brown the meat" is a verb, and brown sugar must not be read into it.
    // Only the tail can be shorthand, and "sugar" isn't a form word.
    const list = [ing("brown sugar")];
    assert.deepEqual(ingredientsForStep(step("Brown the meat well."), list), []);
  });

  it("counts single-word names towards ambiguity too", () => {
    // With both garlic and garlic powder present, "garlic" belongs to two
    // ingredients, so it can't be shorthand for either.
    const list = [ing("garlic"), ing("garlic powder"), ing("flour")];
    assert.deepEqual(names(ingredientsForStep(step("Add the garlic."), list)), ["garlic"]);
  });

  it("finds an ingredient in every step that uses it", () => {
    // "divided" ingredients are real: half now, half later.
    const list = [ing("butter")];
    assert.equal(ingredientsForStep(step("Melt half the butter."), list).length, 1);
    assert.equal(ingredientsForStep(step("Stir in the remaining butter."), list).length, 1);
  });

  it("says nothing for a step that's only technique", () => {
    const list = [ing("flour"), ing("egg")];
    assert.deepEqual(ingredientsForStep(step("Preheat the oven to 180C."), list), []);
    assert.deepEqual(ingredientsForStep(step("Rest for ten minutes."), list), []);
  });

  it("doesn't let a stop word carry a match on its own", () => {
    // A canonical name that reduces to nothing but filler must not match every
    // step that happens to say "the".
    assert.deepEqual(ingredientsForStep(step("Add the salt."), [ing("the")]), []);
  });

  it("falls back to the item name when there's no canonical form", () => {
    const list = [ing("", { item: "gochujang", canonicalItem: "" })];
    assert.equal(ingredientsForStep(step("Stir in the gochujang."), list).length, 1);
  });

  it("copes with an empty step and an empty list", () => {
    assert.deepEqual(ingredientsForStep(step(""), [ing("flour")]), []);
    assert.deepEqual(ingredientsForStep(step("Add the flour."), []), []);
  });

  it("isn't fooled by punctuation or case", () => {
    assert.equal(
      ingredientsForStep(step("Add the FLOUR, then the sugar—slowly."), [
        ing("flour"),
        ing("sugar"),
      ]).length,
      2,
    );
  });
});

describe("ingredientsByStep", () => {
  it("keys by the step's own number, which survives reordering", () => {
    const steps = [step("Add the flour.", 4), step("Add the sugar.", 9)];
    const map = ingredientsByStep(steps, [ing("flour"), ing("sugar")]);
    assert.deepEqual(names(map.get(4)!), ["flour"]);
    assert.deepEqual(names(map.get(9)!), ["sugar"]);
  });

  it("gives every step an entry, even the empty ones", () => {
    const steps = [step("Preheat the oven.", 1), step("Add the flour.", 2)];
    const map = ingredientsByStep(steps, [ing("flour")]);
    assert.equal(map.size, 2);
    assert.deepEqual(map.get(1), []);
  });
});
