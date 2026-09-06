import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { looksLikeRecipe, resolveSource } from "../src/sources/index.js";
import { ResolveError } from "../src/sources/types.js";

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

describe("resolveSource", () => {
  it("wraps a dead link's fetch failure as a ResolveError instead of an unhandled generic Error", async () => {
    // A 404, a deleted post, a site that's down — none of that is a bug in
    // this app, so it must surface as the same 4xx-mapped failure every
    // other resolution problem does, not fall through to a generic 500.
    await assert.rejects(
      () => resolveSource("https://example.com/definitely-not-a-real-page-9f3a7c"),
      (err: unknown) => {
        assert.ok(err instanceof ResolveError, `expected a ResolveError, got ${err}`);
        assert.match((err as Error).message, /Couldn't reach that link/);
        return true;
      },
    );
  });
});
