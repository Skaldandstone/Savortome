import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyRating,
  applyShelfMembership,
  assertValidStars,
  DEFAULT_SHELVES,
  isStatusShelf,
  MAX_SHELF_NAME,
  nextStatus,
  normalizeShelfName,
  ShelfValidationError,
  shouldCountAsCook,
  STATUS_SHELVES,
} from "../src/shelves.js";

describe("shelf types", () => {
  it("ships exactly the three lifecycle shelves", () => {
    assert.deepEqual([...STATUS_SHELVES], ["want_to_cook", "cooking", "cooked"]);
    assert.deepEqual(
      DEFAULT_SHELVES.map((s) => s.type),
      [...STATUS_SHELVES],
    );
  });

  it("separates status shelves from custom ones", () => {
    assert.equal(isStatusShelf("cooked"), true);
    assert.equal(isStatusShelf("custom"), false);
  });
});

describe("normalizeShelfName", () => {
  it("trims and collapses whitespace", () => {
    assert.equal(normalizeShelfName("  Weeknight   Bakes "), "Weeknight Bakes");
  });

  it("rejects an empty name", () => {
    assert.throws(() => normalizeShelfName("   "), ShelfValidationError);
    assert.throws(() => normalizeShelfName(""), ShelfValidationError);
  });

  it("rejects a name past the length limit", () => {
    assert.equal(normalizeShelfName("a".repeat(MAX_SHELF_NAME)).length, MAX_SHELF_NAME);
    assert.throws(() => normalizeShelfName("a".repeat(MAX_SHELF_NAME + 1)), ShelfValidationError);
  });
});

describe("assertValidStars", () => {
  it("accepts 1 through 5", () => {
    for (const n of [1, 2, 3, 4, 5]) assert.doesNotThrow(() => assertValidStars(n));
  });

  it("rejects anything outside that", () => {
    for (const n of [0, 6, -1, 2.5, Number.NaN]) {
      assert.throws(() => assertValidStars(n), ShelfValidationError, `${n} should be rejected`);
    }
  });
});

describe("shouldCountAsCook", () => {
  it("counts the move onto Cooked", () => {
    assert.equal(shouldCountAsCook(null, "cooked"), true);
    assert.equal(shouldCountAsCook("want_to_cook", "cooked"), true);
    assert.equal(shouldCountAsCook("cooking", "cooked"), true);
  });

  it("does not double-count re-marking something already cooked", () => {
    assert.equal(shouldCountAsCook("cooked", "cooked"), false);
  });

  it("does not count moves onto the other shelves", () => {
    assert.equal(shouldCountAsCook("cooked", "cooking"), false);
    assert.equal(shouldCountAsCook(null, "want_to_cook"), false);
  });
});

describe("optimistic updates", () => {
  const base = { shelfIds: ["a"], status: "cooking" as const, rating: null };

  it("toggles a pressed shelf off and any other shelf on", () => {
    assert.equal(nextStatus("cooking", "cooking"), null);
    assert.equal(nextStatus("cooking", "cooked"), "cooked");
    assert.equal(nextStatus(null, "want_to_cook"), "want_to_cook");
  });

  it("adds and removes custom shelf membership without duplicating", () => {
    assert.deepEqual(applyShelfMembership(base, "b", true).shelfIds, ["a", "b"]);
    assert.deepEqual(applyShelfMembership(base, "a", true).shelfIds, ["a"]);
    assert.deepEqual(applyShelfMembership(base, "a", false).shelfIds, []);
  });

  it("keeps the cook counter out of rating changes", () => {
    const cooked = { ...base, rating: { stars: 3, review: null, timesCooked: 4, lastCookedAt: null } };
    const rated = applyRating(cooked, 5);
    assert.equal(rated.rating?.stars, 5);
    assert.equal(rated.rating?.timesCooked, 4);
  });

  it("rates a recipe that has never been cooked", () => {
    assert.equal(applyRating(base, 2).rating?.timesCooked, 0);
  });
});
