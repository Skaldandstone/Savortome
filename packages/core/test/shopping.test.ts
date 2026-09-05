import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildShoppingList, formatListAsText } from "../src/shopping.js";
import { CART_PROVIDERS_BY_ID, availableProviders, buildHandoff } from "../src/carts.js";
import { createInstacartList, toInstacartLineItems } from "../src/carts-instacart.js";
import type { Ingredient } from "../src/recipe.js";
import type { PantryEntry } from "../src/pantry.js";

const ing = (
  canonicalItem: string,
  quantity: number | null,
  unit: string | null,
  extra: Partial<Ingredient> = {},
): Ingredient => ({
  raw: canonicalItem,
  quantity,
  quantityMax: null,
  unit,
  item: canonicalItem,
  canonicalItem,
  notes: null,
  optional: false,
  group: null,
  ...extra,
});

const pantryEntry = (
  canonicalItem: string,
  quantity: number | null = null,
  unit: string | null = null,
): PantryEntry => ({
  canonicalItem,
  displayName: canonicalItem,
  quantity,
  unit,
  isStaple: false,
});

const lineFor = (lines: ReturnType<typeof buildShoppingList>, item: string) =>
  lines.find((l) => l.canonicalItem === item);

// Unit-family/conversion/rounding behavior lives in units-convert.test.ts now
// — dedicated coverage there, including case-insensitivity, rather than a
// partial re-test of the same functions here.

describe("buildShoppingList", () => {
  it("merges the same ingredient across recipes", () => {
    const lines = buildShoppingList(
      new Map([
        ["a", [ing("all purpose flour", 1, "cup")]],
        ["b", [ing("all purpose flour", 2, "cup")]],
      ]),
      { skipStaples: false },
    );

    const flour = lineFor(lines, "all purpose flour")!;
    assert.equal(flour.quantity, 3);
    assert.equal(flour.unit, "cup");
    assert.deepEqual(flour.recipeIds.sort(), ["a", "b"]);
  });

  it("converts compatible units before adding", () => {
    const lines = buildShoppingList(
      new Map([
        ["a", [ing("milk", 1, "cup")]],
        ["b", [ing("milk", 2, "tbsp")]],
      ]),
    );

    const milk = lineFor(lines, "milk")!;
    assert.equal(milk.unit, "cup");
    // 2 tbsp is an eighth of a cup.
    assert.equal(milk.quantity, 1.125);
  });

  it("keeps incompatible units as separate lines", () => {
    const lines = buildShoppingList(
      new Map([
        ["a", [ing("butter", 1, "cup")]],
        ["b", [ing("butter", 200, "g")]],
      ]),
    );

    const butter = lines.filter((l) => l.canonicalItem === "butter");
    assert.equal(butter.length, 2, "volume and weight must not be guessed into one line");
    assert.deepEqual(butter.map((l) => l.unit).sort(), ["cup", "g"]);
  });

  it("merges the same discrete unit even when a model extraction cased it differently", () => {
    // Nothing runs a model-extracted unit through normalizeUnit the way the
    // deterministic parser does, so two recipes can genuinely disagree on
    // "clove" vs "Clove" for what is the same real unit.
    const lines = buildShoppingList(
      new Map([
        ["a", [ing("garlic", 2, "Clove")]],
        ["b", [ing("garlic", 3, "clove")]],
      ]),
      { skipStaples: false },
    );

    const garlic = lines.filter((l) => l.canonicalItem === "garlic");
    assert.equal(garlic.length, 1, "same unit, different case, must still be one line");
    assert.equal(garlic[0]!.quantity, 5);
  });

  it("shops for the top of a range", () => {
    const lines = buildShoppingList(
      new Map([["a", [ing("garlic", 2, "clove", { quantityMax: 3 })]]]),
      { skipStaples: false },
    );
    assert.equal(lineFor(lines, "garlic")!.quantity, 3);
  });

  it("keeps an item with no stated amount, and says the amount is unknown", () => {
    const lines = buildShoppingList(new Map([["a", [ing("parsley", null, null)]]]));
    const parsley = lineFor(lines, "parsley")!;
    assert.equal(parsley.quantity, null);
    assert.equal(parsley.amountUnknown, true);
  });

  it("leaves staples and optional extras off by default", () => {
    const lines = buildShoppingList(
      new Map([
        ["a", [ing("salt", 1, "tsp"), ing("chili crisp", 1, "tbsp", { optional: true }), ing("rice", 1, "cup")]],
      ]),
    );
    assert.deepEqual(
      lines.map((l) => l.canonicalItem),
      ["rice"],
    );
  });

  it("can be asked to include them", () => {
    const lines = buildShoppingList(
      new Map([["a", [ing("salt", 1, "tsp"), ing("chili crisp", 1, "tbsp", { optional: true })]]]),
      { skipStaples: false, skipOptional: false },
    );
    assert.equal(lines.length, 2);
  });

  it("picks the plainest of the names the recipes used", () => {
    const lines = buildShoppingList(
      new Map([
        ["a", [ing("yellow onion", 1, null, { item: "large yellow onion, halved" })]],
        ["b", [ing("yellow onion", 2, null, { item: "onion" })]],
      ]),
    );
    assert.equal(lineFor(lines, "yellow onion")!.displayName, "onion");
  });

  it("sorts alphabetically so the list reads the same every time", () => {
    const lines = buildShoppingList(
      new Map([["a", [ing("rice", 1, "cup"), ing("apple", 2, null), ing("noodle", 1, null)]]]),
    );
    assert.deepEqual(
      lines.map((l) => l.displayName),
      ["apple", "noodle", "rice"],
    );
  });
});

describe("buildShoppingList against a pantry", () => {
  it("drops anything the kitchen has with no amount recorded", () => {
    const lines = buildShoppingList(new Map([["a", [ing("rice", 1, "cup")]]]), {
      pantry: [pantryEntry("rice")],
    });
    assert.deepEqual(lines, []);
  });

  it("subtracts what's on hand and buys the shortfall", () => {
    const lines = buildShoppingList(new Map([["a", [ing("rice", 3, "cup")]]]), {
      pantry: [pantryEntry("rice", 1, "cup")],
    });
    assert.equal(lineFor(lines, "rice")!.quantity, 2);
  });

  it("drops the line when the kitchen has enough", () => {
    const lines = buildShoppingList(new Map([["a", [ing("rice", 1, "cup")]]]), {
      pantry: [pantryEntry("rice", 4, "cup")],
    });
    assert.deepEqual(lines, []);
  });

  it("converts before subtracting", () => {
    const lines = buildShoppingList(new Map([["a", [ing("milk", 2, "cup")]]]), {
      pantry: [pantryEntry("milk", 236.588, "ml")], // one cup
    });
    assert.equal(lineFor(lines, "milk")!.quantity, 1);
  });

  it("still buys, but flags it, when the amounts can't be compared", () => {
    const lines = buildShoppingList(new Map([["a", [ing("butter", 1, "cup")]]]), {
      pantry: [pantryEntry("butter", 200, "g")],
    });
    const butter = lineFor(lines, "butter")!;
    assert.equal(butter.quantity, 1);
    assert.equal(butter.mayAlreadyHave, true);
  });

  it("ignores pantry items no recipe asked for", () => {
    const lines = buildShoppingList(new Map([["a", [ing("rice", 1, "cup")]]]), {
      pantry: [pantryEntry("saffron", 1, "g")],
    });
    assert.equal(lines.length, 1);
  });
});

describe("formatListAsText", () => {
  it("writes one item per line with the amount first", () => {
    const lines = buildShoppingList(
      new Map([["a", [ing("rice", 2, "cup"), ing("parsley", null, null)]]]),
    );
    assert.equal(formatListAsText(lines), "parsley\n2 cup rice");
  });

  it("leaves out what's already been ticked off", () => {
    const lines = buildShoppingList(new Map([["a", [ing("rice", 2, "cup"), ing("apple", 1, null)]]]));
    lines[0]!.checked = true;
    assert.equal(formatListAsText(lines), "2 cup rice");
  });
});

describe("cart providers", () => {
  it("is explicit about which services have a real cart API", () => {
    assert.equal(CART_PROVIDERS_BY_ID.instacart.kind, "api");
    assert.equal(CART_PROVIDERS_BY_ID.kroger.kind, "api");
    // These have no public consumer cart API, and the type says so.
    assert.equal(CART_PROVIDERS_BY_ID.doordash.kind, "handoff");
    assert.equal(CART_PROVIDERS_BY_ID.ubereats.kind, "handoff");
    assert.equal(CART_PROVIDERS_BY_ID.safeway.kind, "handoff");
  });

  it("only offers an API provider once its key is configured", () => {
    const withoutKeys = availableProviders({}).map((p) => p.id);
    assert.equal(withoutKeys.includes("instacart"), false);
    assert.equal(withoutKeys.includes("clipboard"), true);
    assert.equal(withoutKeys.includes("doordash"), true);

    const withKey = availableProviders({ INSTACART_API_KEY: "test" }).map((p) => p.id);
    assert.equal(withKey.includes("instacart"), true);
  });

  it("builds a handoff that says plainly what it did", () => {
    const lines = buildShoppingList(new Map([["a", [ing("rice", 2, "cup")]]]));
    const handoff = buildHandoff("doordash", lines);

    assert.equal(handoff.kind, "handoff");
    assert.equal(handoff.text, "2 cup rice");
    assert.match(handoff.url, /doordash\.com/);
    assert.match(handoff.note, /no public cart API/i);
  });

  it("copies without opening anything for the clipboard provider", () => {
    const lines = buildShoppingList(new Map([["a", [ing("rice", 2, "cup")]]]));
    const handoff = buildHandoff("clipboard", lines);
    assert.equal(handoff.url, "");
    assert.equal(handoff.text, "2 cup rice");
  });
});

describe("Instacart line items", () => {
  it("sends measurements rather than the deprecated quantity/unit fields", () => {
    const lines = buildShoppingList(new Map([["a", [ing("rice", 2, "cup")]]]));
    const [item] = toInstacartLineItems(lines);

    assert.equal(item?.name, "rice");
    assert.deepEqual(item?.line_item_measurements, [{ quantity: 2, unit: "cup" }]);
  });

  it("omits measurements when no amount was stated", () => {
    const lines = buildShoppingList(new Map([["a", [ing("parsley", null, null)]]]));
    const [item] = toInstacartLineItems(lines);
    assert.equal(item?.line_item_measurements, undefined);
  });

  it("leaves out anything already ticked off", () => {
    const lines = buildShoppingList(new Map([["a", [ing("rice", 2, "cup"), ing("apple", 1, null)]]]));
    lines[0]!.checked = true;
    assert.deepEqual(toInstacartLineItems(lines).map((i) => i.name), ["rice"]);
  });

  it("refuses to call the API without a key", async () => {
    const lines = buildShoppingList(new Map([["a", [ing("rice", 2, "cup")]]]));
    await assert.rejects(
      () => createInstacartList(lines, { apiKey: "" }),
      /INSTACART_API_KEY/,
    );
  });
});

describe("formatListAsText fractions", () => {
  it("writes fractions the way the on-screen list does", () => {
    const lines = buildShoppingList(new Map([["a", [ing("milk", 0.5, "cup")]]]));
    assert.equal(formatListAsText(lines), "\u00bd cup milk");
  });

  it("still writes a bare name when no amount is known", () => {
    const lines = buildShoppingList(new Map([["a", [ing("parsley", null, null)]]]));
    assert.equal(formatListAsText(lines), "parsley");
  });
});
