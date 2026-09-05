import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { needsInterpretation, parseQueryLocally } from "../src/pantry-query.js";

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
