import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  describeMatch,
  matchRecipe,
  parsePantryInput,
  rankMatches,
  requirementsFor,
  type PantryMatch,
} from "../src/pantry.js";
import { needsInterpretation, parseQueryLocally } from "../src/pantry-query.js";
import { isStaple } from "../src/staples.js";
import type { Ingredient } from "../src/recipe.js";

const ing = (canonicalItem: string, optional = false): Ingredient => ({
  raw: canonicalItem,
  quantity: 1,
  quantityMax: null,
  unit: null,
  item: canonicalItem,
  canonicalItem,
  notes: null,
  optional,
  group: null,
});

describe("requirementsFor", () => {
  it("splits ingredients into required, optional, and staple", () => {
    const r = requirementsFor("r1", [
      ing("chicken thigh"),
      ing("yellow onion"),
      ing("salt"), // staple
      ing("olive oil"), // staple
      ing("chili crisp", true), // optional
    ]);

    assert.deepEqual(r.required.sort(), ["chicken thigh", "yellow onion"]);
    assert.deepEqual(r.optional, ["chili crisp"]);
    assert.deepEqual(r.staples.sort(), ["olive oil", "salt"]);
  });

  it("treats a staple as a staple even when the recipe marks it optional", () => {
    const r = requirementsFor("r1", [ing("salt", true)]);
    assert.deepEqual(r.staples, ["salt"]);
    assert.deepEqual(r.optional, []);
  });

  it("collapses duplicates and ignores blanks", () => {
    const r = requirementsFor("r1", [ing("leek"), ing("leek"), ing("")]);
    assert.deepEqual(r.required, ["leek"]);
  });
});

describe("matchRecipe", () => {
  const requirements = requirementsFor("r1", [
    ing("chicken thigh"),
    ing("yellow onion"),
    ing("rice"),
    ing("salt"),
    ing("chili crisp", true),
  ]);

  it("can make it when every required ingredient is on hand", () => {
    const m = matchRecipe(requirements, {
      pantry: new Set(["chicken thigh", "yellow onion", "rice"]),
    });
    assert.equal(m.canMakeNow, true);
    assert.deepEqual(m.missing, []);
    assert.equal(m.coverage, 1);
  });

  it("does not need staples to be in the pantry", () => {
    // "salt" is never added by the user, and must not block the match.
    const m = matchRecipe(requirements, {
      pantry: new Set(["chicken thigh", "yellow onion", "rice"]),
    });
    assert.equal(m.canMakeNow, true);
    assert.deepEqual(m.missingStaples, []);
  });

  it("reports a staple only when explicitly marked as out", () => {
    const m = matchRecipe(requirements, {
      pantry: new Set(["chicken thigh", "yellow onion", "rice"]),
      missingStaples: new Set(["salt"]),
    });
    assert.deepEqual(m.missingStaples, ["salt"]);
    // Still cookable — you can buy salt, and it shouldn't hide the recipe.
    assert.equal(m.canMakeNow, true);
  });

  it("never lets an optional ingredient block a match", () => {
    const m = matchRecipe(requirements, {
      pantry: new Set(["chicken thigh", "yellow onion", "rice"]),
    });
    assert.deepEqual(m.missingOptional, ["chili crisp"]);
    assert.equal(m.canMakeNow, true);
  });

  it("lists what's missing and scores partial coverage", () => {
    const m = matchRecipe(requirements, { pantry: new Set(["chicken thigh"]) });
    assert.equal(m.canMakeNow, false);
    assert.deepEqual(m.missing.sort(), ["rice", "yellow onion"]);
    assert.ok(Math.abs(m.coverage - 1 / 3) < 1e-9);
  });

  it("counts a recipe of nothing but staples as cookable", () => {
    const m = matchRecipe(requirementsFor("r2", [ing("salt"), ing("water")]), {
      pantry: new Set(),
    });
    assert.equal(m.canMakeNow, true);
    assert.equal(m.coverage, 1);
  });
});

describe("rankMatches", () => {
  const make = (recipeId: string, missing: string[], coverage: number): PantryMatch => ({
    recipeId,
    have: [],
    missing,
    missingOptional: [],
    missingStaples: [],
    coverage,
    canMakeNow: missing.length === 0,
  });

  it("puts what you can cook now first, then what you're closest to", () => {
    const ranked = rankMatches([
      make("far", ["a", "b", "c"], 0.25),
      make("now", [], 1),
      make("close", ["a"], 0.75),
    ]);
    assert.deepEqual(
      ranked.map((m) => m.recipeId),
      ["now", "close", "far"],
    );
  });

  it("breaks ties toward what you actually cook", () => {
    const ranked = rankMatches(
      [make("rare", [], 1), make("favourite", [], 1)],
      new Map([
        ["favourite", 9],
        ["rare", 0],
      ]),
    );
    assert.equal(ranked[0]!.recipeId, "favourite");
  });

  it("leaves the caller's array untouched", () => {
    const input = [make("b", ["x"], 0.5), make("a", [], 1)];
    rankMatches(input);
    assert.equal(input[0]!.recipeId, "b");
  });
});

describe("describeMatch", () => {
  const base: PantryMatch = {
    recipeId: "r",
    have: [],
    missing: [],
    missingOptional: [],
    missingStaples: [],
    coverage: 1,
    canMakeNow: true,
  };

  it("says so when nothing is missing", () => {
    assert.equal(describeMatch(base), "You have everything");
  });

  it("names a single missing ingredient", () => {
    assert.equal(
      describeMatch({ ...base, missing: ["rice"], canMakeNow: false }),
      "Missing rice",
    );
  });

  it("lists a few, then counts beyond that", () => {
    assert.equal(
      describeMatch({ ...base, missing: ["rice", "leek"], canMakeNow: false }),
      "Missing rice and leek",
    );
    assert.equal(
      describeMatch({ ...base, missing: ["a", "b", "c", "d"], canMakeNow: false }),
      "Missing 4 ingredients",
    );
  });

  it("calls out staples you've marked as out", () => {
    assert.equal(
      describeMatch({ ...base, missingStaples: ["salt"] }),
      "You have everything except salt",
    );
  });
});

describe("parsePantryInput", () => {
  it("parses a comma-separated list into canonical items", () => {
    const items = parsePantryInput("2 chicken thighs, rice, a can of chopped tomatoes");
    assert.deepEqual(
      items.map((i) => i.canonicalItem),
      ["chicken thigh", "rice", "tomato"],
    );
  });

  it("splits on newlines and semicolons too", () => {
    const items = parsePantryInput("eggs\nmilk; butter");
    assert.deepEqual(
      items.map((i) => i.canonicalItem),
      ["egg", "milk", "butter"],
    );
  });

  it("keeps quantities where they were given", () => {
    const [thighs] = parsePantryInput("500g chicken thighs");
    assert.equal(thighs?.quantity, 500);
    assert.equal(thighs?.unit, "g");
  });

  it("flags staples so they can be assumed present", () => {
    const [salt] = parsePantryInput("salt");
    assert.equal(salt?.isStaple, true);
  });

  it("deduplicates and drops blanks", () => {
    const items = parsePantryInput("onion, , onions,");
    assert.equal(items.length, 1);
  });

  it("agrees with the naming the recipe index uses", () => {
    // This is the property the whole feature rests on: pantry entries and
    // recipe ingredients must land on the same key.
    const [pantryOnion] = parsePantryInput("2 diced yellow onions");
    const recipe = requirementsFor("r", [ing("yellow onion")]);
    assert.equal(recipe.required[0], pantryOnion?.canonicalItem);
  });
});

describe("needsInterpretation", () => {
  it("handles a plain list without a model", () => {
    assert.equal(needsInterpretation("chicken, rice, onion"), false);
    assert.equal(needsInterpretation("eggs"), false);
    assert.equal(needsInterpretation(""), false);
  });

  it("spots constraints that need reading", () => {
    for (const q of [
      "something quick with chicken",
      "vegetarian dinner",
      "pasta without dairy",
      "under 30 minutes",
      "what can I make for breakfast with the eggs I have left",
    ]) {
      assert.equal(needsInterpretation(q), true, `"${q}" should be interpreted`);
    }
  });

  it("treats a long comma-free sentence as prose", () => {
    assert.equal(needsInterpretation("I would really like to use up these things today"), true);
  });
});

describe("parseQueryLocally", () => {
  it("treats everything as ingredients", () => {
    const q = parseQueryLocally("chicken thighs, rice");
    assert.deepEqual(q.ingredients, ["chicken thigh", "rice"]);
    assert.deepEqual(q.tags, []);
    assert.equal(q.maxMinutes, null);
  });
});

describe("what counts as a staple", () => {
  it("assumes shelf-stable seasoning and baking basics", () => {
    for (const item of ["salt", "olive oil", "all purpose flour", "soy sauce", "baking powder"]) {
      assert.equal(isStaple(item), true, `${item} should be a staple`);
    }
  });

  it("never assumes a perishable, however common", () => {
    // Saying "you can make this" when the eggs ran out is the failure that
    // stops the whole feature being trusted.
    for (const item of ["egg", "milk", "butter", "yellow onion", "garlic", "chicken thigh"]) {
      assert.equal(isStaple(item), false, `${item} should not be a staple`);
    }
  });

  it("blocks a match on a missing perishable but not on a missing staple", () => {
    const recipe = requirementsFor("r", [ing("egg"), ing("flour"), ing("sugar")]);
    assert.deepEqual(recipe.required, ["egg"]);

    assert.equal(matchRecipe(recipe, { pantry: new Set() }).canMakeNow, false);
    assert.equal(matchRecipe(recipe, { pantry: new Set(["egg"]) }).canMakeNow, true);
  });
});
