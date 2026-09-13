import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pantryAttention, storageGuideFor } from "../src/pantry-guidance.js";

describe("storageGuideFor", () => {
  it("uses canonical pantry names and returns reviewed source links", () => {
    const bananas = storageGuideFor("ripe bananas");
    assert.equal(bananas?.id, "banana");
    assert.equal(bananas?.defaultStorage, "countertop");
    assert.match(bananas?.sourceUrl ?? "", /^https:\/\/(?:www\.)?(?:fns\.usda\.gov|fda\.gov)\//);
  });

  it("does not invent guidance for an unknown item", () => {
    assert.equal(storageGuideFor("dragon noodles"), null);
  });
});

describe("pantryAttention", () => {
  const now = new Date("2026-09-13T12:00:00.000Z");

  it("gently resurfaces bananas after the quality-check threshold", () => {
    const result = pantryAttention({
      canonicalItem: "banana",
      displayName: "6 bananas",
      acquiredAt: "2026-09-09T12:00:00.000Z",
      lastConfirmedAt: null,
    }, now);
    assert.equal(result?.shouldResurface, true);
    assert.equal(result?.daysSinceKnown, 4);
    assert.match(result?.message ?? "", /Still have 6 bananas/);
    assert.doesNotMatch(result?.message ?? "", /bad|expired|unsafe|need potassium/i);
  });

  it("uses the latest human confirmation instead of an older purchase date", () => {
    const result = pantryAttention({
      canonicalItem: "banana",
      displayName: "bananas",
      acquiredAt: "2026-09-01T12:00:00.000Z",
      lastConfirmedAt: "2026-09-12T12:00:00.000Z",
    }, now);
    assert.equal(result?.daysSinceKnown, 1);
    assert.equal(result?.shouldResurface, false);
  });

  it("treats guidance as optional when dates are unknown or malformed", () => {
    const result = pantryAttention({
      canonicalItem: "tomato",
      displayName: "tomatoes",
      acquiredAt: "not-a-date",
    }, now);
    assert.equal(result?.daysSinceKnown, null);
    assert.equal(result?.shouldResurface, false);
  });
});
