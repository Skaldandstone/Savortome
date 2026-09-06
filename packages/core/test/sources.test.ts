import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { looksLikeRecipe } from "../src/sources/index.js";

describe("looksLikeRecipe", () => {
  it("rejects a caption that's just a title and hashtags", () => {
    // The exact shape that used to slip past the old length-only check and
    // waste a model call: a title plus hashtags easily clears any character
    // count while containing zero actual recipe content.
    assert.equal(
      looksLikeRecipe(
        "Shepherd's Pie Stuffed Potatoes #recipe #cooking #shepherdspie #comfortfood #dinner #foodtiktok",
      ),
      false,
    );
  });

  it("accepts a caption with two or more measured amounts", () => {
    assert.equal(looksLikeRecipe("2 cups flour, 1 tbsp sugar, a pinch of salt"), true);
  });

  it("doesn't count a single measured amount as enough on its own", () => {
    // One quantity could just as easily be an unrelated aside in a caption
    // ("cooked for 2 hours" isn't a recipe by itself either) — the bar is
    // real breadth, not one lucky match.
    assert.equal(looksLikeRecipe("this took me 2 hours to make lol"), false);
  });

  it("accepts numbered steps even with no measured amounts", () => {
    assert.equal(looksLikeRecipe("1. chop the onion\n2. fry it\n3. add the rest"), true);
    assert.equal(looksLikeRecipe("Step 1: preheat the oven\nStep 2: mix everything"), true);
  });

  it("accepts an explicit ingredients/directions label", () => {
    assert.equal(looksLikeRecipe("Ingredients: onion, garlic, oil"), true);
    assert.equal(looksLikeRecipe("Directions: mix and bake"), true);
  });

  it("rejects blank or missing captions", () => {
    assert.equal(looksLikeRecipe(null), false);
    assert.equal(looksLikeRecipe(""), false);
    assert.equal(looksLikeRecipe("   "), false);
  });

  it("rejects ordinary prose with numbers in it that aren't measurements", () => {
    assert.equal(looksLikeRecipe("my grandma turned 90 and made this for the 3rd time this year"), false);
  });
});
