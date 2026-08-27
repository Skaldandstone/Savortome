import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { courseBucket, suggestPairings, type PairingCandidate } from "../src/pairing.js";

function candidate(over: Partial<PairingCandidate> & { id: string }): PairingCandidate {
  return {
    title: over.id,
    imageUrl: null,
    cuisine: null,
    course: null,
    ...over,
  };
}

describe("courseBucket", () => {
  it("recognizes sides", () => {
    assert.equal(courseBucket("side dish"), "side");
    assert.equal(courseBucket("Salad"), "side");
  });

  it("recognizes drinks", () => {
    assert.equal(courseBucket("cocktail"), "drink");
  });

  it("recognizes desserts", () => {
    assert.equal(courseBucket("Dessert"), "dessert");
  });

  it("returns null for a main", () => {
    assert.equal(courseBucket("main"), null);
  });

  it("returns null for an unset course", () => {
    assert.equal(courseBucket(null), null);
  });

  it("returns null for text that doesn't match any slot", () => {
    assert.equal(courseBucket("brunch"), null);
  });
});

describe("suggestPairings", () => {
  it("excludes the main recipe itself even if it would otherwise match", () => {
    const main = { id: "m1", cuisine: "italian" };
    const library = [candidate({ id: "m1", course: "side" })];
    const result = suggestPairings(main, library);
    assert.deepEqual(result.side, []);
  });

  it("excludes mains and anything unclassifiable", () => {
    const main = { id: "m1", cuisine: null };
    const library = [
      candidate({ id: "a", course: "main" }),
      candidate({ id: "b", course: null }),
      candidate({ id: "c", course: "brunch" }),
    ];
    const result = suggestPairings(main, library);
    assert.deepEqual(result, { side: [], drink: [], dessert: [] });
  });

  it("buckets candidates into the right slot", () => {
    const main = { id: "m1", cuisine: null };
    const library = [
      candidate({ id: "a", title: "Green salad", course: "side" }),
      candidate({ id: "b", title: "Lemonade", course: "drink" }),
      candidate({ id: "c", title: "Brownies", course: "dessert" }),
    ];
    const result = suggestPairings(main, library);
    assert.deepEqual(result.side.map((c) => c.id), ["a"]);
    assert.deepEqual(result.drink.map((c) => c.id), ["b"]);
    assert.deepEqual(result.dessert.map((c) => c.id), ["c"]);
  });

  it("prefers same-cuisine candidates over others", () => {
    const main = { id: "m1", cuisine: "mexican" };
    const library = [
      candidate({ id: "a", title: "Coleslaw", course: "side", cuisine: "american" }),
      candidate({ id: "b", title: "Elote", course: "side", cuisine: "mexican" }),
    ];
    const result = suggestPairings(main, library);
    assert.deepEqual(result.side.map((c) => c.id), ["b", "a"]);
  });

  it("breaks ties by title", () => {
    const main = { id: "m1", cuisine: null };
    const library = [
      candidate({ id: "a", title: "Zucchini fritters", course: "side" }),
      candidate({ id: "b", title: "Apple slaw", course: "side" }),
    ];
    const result = suggestPairings(main, library);
    assert.deepEqual(result.side.map((c) => c.id), ["b", "a"]);
  });

  it("caps each slot at the given limit", () => {
    const main = { id: "m1", cuisine: null };
    const library = Array.from({ length: 5 }, (_, i) =>
      candidate({ id: `s${i}`, title: `Side ${i}`, course: "side" }),
    );
    const result = suggestPairings(main, library, 2);
    assert.equal(result.side.length, 2);
  });

  it("returns empty slots for an empty library", () => {
    const result = suggestPairings({ id: "m1", cuisine: null }, []);
    assert.deepEqual(result, { side: [], drink: [], dessert: [] });
  });
});
