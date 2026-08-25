import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canonicalize,
  parseIngredientLine,
  parseQuantity,
  scaleQuantity,
} from "../src/units.js";

describe("parseQuantity", () => {
  const cases: [string, number][] = [
    ["2 eggs", 2],
    ["1.5 cups flour", 1.5],
    ["1 1/2 cups flour", 1.5],
    ["1/2 tsp salt", 0.5],
    ["½ tsp salt", 0.5],
    ["1½ cups flour", 1.5],
    ["1 ¾ cups flour", 1.75],
    ["⅓ cup oil", 1 / 3],
    ["a pinch of salt", 1],
    ["two large onions", 2],
  ];

  for (const [input, expected] of cases) {
    it(`reads "${input}" as ${expected}`, () => {
      const got = parseQuantity(input);
      assert.ok(got, `expected a quantity from "${input}"`);
      assert.ok(Math.abs(got.value - expected) < 1e-6, `got ${got.value}`);
    });
  }

  it("returns null when the line does not start with an amount", () => {
    assert.equal(parseQuantity("salt to taste"), null);
  });
});

describe("parseIngredientLine", () => {
  it("splits amount, unit, item, and prep", () => {
    const i = parseIngredientLine("1 large yellow onion, finely diced");
    assert.equal(i.quantity, 1);
    assert.equal(i.unit, null); // "large" is a size, not a unit
    assert.equal(i.item, "large yellow onion");
    assert.equal(i.notes, "finely diced");
    assert.equal(i.canonicalItem, "yellow onion");
  });

  it("normalizes unit spellings", () => {
    assert.equal(parseIngredientLine("2 tablespoons olive oil").unit, "tbsp");
    assert.equal(parseIngredientLine("3 Tbsp. butter").unit, "tbsp");
    assert.equal(parseIngredientLine("500 grams beef chuck").unit, "g");
  });

  it("captures ranges", () => {
    const i = parseIngredientLine("2-3 cloves garlic, minced");
    assert.equal(i.quantity, 2);
    assert.equal(i.quantityMax, 3);
    assert.equal(i.unit, "clove");
    assert.equal(i.canonicalItem, "garlic");
  });

  it("drops a package-size parenthetical rather than treating it as the unit", () => {
    const i = parseIngredientLine("1 (14.5 oz) can diced tomatoes");
    assert.equal(i.quantity, 1);
    assert.equal(i.unit, "can");
    assert.equal(i.canonicalItem, "tomato");
  });

  it("drops a metric equivalent sitting between the unit and the food", () => {
    const i = parseIngredientLine("1 cup (225 grams) mashed ripe bananas");
    assert.equal(i.unit, "cup");
    assert.equal(i.item, "mashed ripe bananas");
  });

  it("marks optional ingredients", () => {
    assert.equal(parseIngredientLine("1 tbsp chili crisp (optional)").optional, true);
    assert.equal(parseIngredientLine("1 tbsp chili crisp").optional, false);
  });

  it("keeps an unparseable line intact instead of mangling it", () => {
    const i = parseIngredientLine("Kosher salt and freshly ground black pepper");
    assert.equal(i.quantity, null);
    assert.equal(i.unit, null);
    assert.equal(i.item, "Kosher salt and freshly ground black pepper");
  });
});

describe("canonicalize", () => {
  const cases: [string, string][] = [
    ["Yellow Onions", "yellow onion"],
    ["boneless skinless chicken thighs", "chicken thigh"],
    ["fresh flat-leaf parsley", "flat leaf parsley"],
    ["Cherry Tomatoes", "cherry tomato"],
    ["large eggs", "egg"],
    ["unsalted butter", "butter"],
    ["molasses", "molasses"],
  ];

  for (const [input, expected] of cases) {
    it(`"${input}" -> "${expected}"`, () => {
      assert.equal(canonicalize(input), expected);
    });
  }

  it("gives the same key to two spellings of the same food", () => {
    // This is the property the pantry matcher and shopping list depend on.
    assert.equal(
      parseIngredientLine("1 diced Yellow Onion").canonicalItem,
      parseIngredientLine("2 yellow onions, diced").canonicalItem,
    );
  });
});

describe("scaleQuantity", () => {
  it("keeps small amounts on measurable eighths", () => {
    assert.equal(scaleQuantity(0.5, 1.5), 0.75);
    assert.equal(scaleQuantity(1 / 3, 2), 0.625); // nearest eighth to 0.667
  });

  it("rounds large amounts to whole numbers", () => {
    assert.equal(scaleQuantity(8, 1.5), 12);
  });

  it("leaves unstated amounts unstated", () => {
    assert.equal(scaleQuantity(null, 2), null);
  });
});
