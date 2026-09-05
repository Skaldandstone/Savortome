import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canCombine, convert, tidyQuantity, toBase, unitFamily } from "../src/units-convert.js";

describe("unitFamily", () => {
  it("groups volume units together", () => {
    for (const unit of ["ml", "l", "tsp", "tbsp", "floz", "cup", "pint", "quart", "gallon"]) {
      assert.equal(unitFamily(unit), "volume", unit);
    }
  });

  it("groups weight units together", () => {
    for (const unit of ["g", "kg", "oz", "lb"]) {
      assert.equal(unitFamily(unit), "weight", unit);
    }
  });

  it("treats anything else, including no unit at all, as a count", () => {
    assert.equal(unitFamily("clove"), "count");
    assert.equal(unitFamily("can"), "count");
    assert.equal(unitFamily(null), "count");
  });

  it("is case-insensitive", () => {
    assert.equal(unitFamily("Cup"), "volume");
    assert.equal(unitFamily("KG"), "weight");
  });
});

describe("canCombine", () => {
  it("combines volume units with each other", () => {
    assert.equal(canCombine("tsp", "cup"), true);
  });

  it("combines weight units with each other", () => {
    assert.equal(canCombine("g", "lb"), true);
  });

  it("never combines volume with weight", () => {
    assert.equal(canCombine("cup", "g"), false);
  });

  it("combines a count unit only with the exact same one", () => {
    assert.equal(canCombine("clove", "clove"), true);
    assert.equal(canCombine("clove", "can"), false);
  });

  it("combines the same count unit regardless of case", () => {
    // A model extraction never runs a count unit through normalizeUnit the
    // way the deterministic parser does, so two recipes can plausibly
    // disagree on "clove" vs "Clove" for the same real unit.
    assert.equal(canCombine("Clove", "clove"), true);
    assert.equal(canCombine("CAN", "can"), true);
  });

  it("is case-insensitive for volume and weight too", () => {
    assert.equal(canCombine("Cup", "cup"), true);
    assert.equal(canCombine("KG", "kg"), true);
  });
});

describe("convert", () => {
  it("converts within the volume family", () => {
    assert.equal(Math.round(convert(1, "cup", "tbsp")!), 16);
  });

  it("converts within the weight family", () => {
    assert.equal(Math.round(convert(1, "lb", "g")! * 100) / 100, 453.59);
  });

  it("returns null across families", () => {
    assert.equal(convert(1, "cup", "g"), null);
  });

  it("returns null for an unrecognized unit", () => {
    assert.equal(convert(1, "smidgen", "cup"), null);
  });

  it("converts a count unit case-insensitively, unchanged in value", () => {
    assert.equal(convert(2, "Clove", "clove"), 2);
  });
});

describe("toBase", () => {
  it("passes a count quantity through unchanged", () => {
    assert.equal(toBase(3, "clove"), 3);
  });

  it("scales a volume unit to millilitres", () => {
    assert.equal(toBase(1, "l"), 1000);
  });
});

describe("tidyQuantity", () => {
  it("rounds a large amount to a whole number", () => {
    assert.equal(tidyQuantity(101.4), 101);
  });

  it("rounds a medium amount to the nearest half", () => {
    assert.equal(tidyQuantity(10.2), 10);
    assert.equal(tidyQuantity(10.3), 10.5);
  });

  it("rounds a small amount to the nearest eighth", () => {
    assert.equal(tidyQuantity(0.4), 0.375);
  });

  it("treats a non-finite value as zero", () => {
    assert.equal(tidyQuantity(NaN), 0);
    assert.equal(tidyQuantity(Infinity), 0);
  });
});
