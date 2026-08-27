import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cookedLabel, isLibrarySort, librarySortOr } from "../src/library.js";

describe("library sorts", () => {
  it("recognises the ones that exist", () => {
    assert.equal(isLibrarySort("rated"), true);
    assert.equal(isLibrarySort("newest"), true);
  });

  it("rejects anything else", () => {
    assert.equal(isLibrarySort("sideways"), false);
    assert.equal(isLibrarySort(null), false);
    assert.equal(isLibrarySort(undefined), false);
  });

  it("falls back rather than throwing, so a hand-edited URL still renders", () => {
    assert.equal(librarySortOr("sideways"), "newest");
    assert.equal(librarySortOr(null), "newest");
    assert.equal(librarySortOr("quickest"), "quickest");
  });
});

describe("cookedLabel", () => {
  it("counts in words where words read better", () => {
    assert.equal(cookedLabel(1), "Cooked once");
    assert.equal(cookedLabel(2), "Cooked twice");
    assert.equal(cookedLabel(3), "Cooked 3 times");
  });

  it("says nothing rather than nagging about zero", () => {
    // A card announcing "cooked 0 times" is an accusation, not information.
    assert.equal(cookedLabel(0), null);
    assert.equal(cookedLabel(-1), null);
  });
});
