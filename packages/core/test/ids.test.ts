import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isUuid, uuidOrUndefined } from "../src/ids.js";

describe("isUuid", () => {
  it("accepts the ids the database actually issues", () => {
    // Real ids from the app, v4 as gen_random_uuid() produces.
    assert.equal(isUuid("eb0ca262-f21c-4a2d-96ee-e2bcd13a3081"), true);
    assert.equal(isUuid("32823560-41e2-423d-8a3e-b83e710dc118"), true);
  });

  it("is case insensitive, because URLs get shouted at", () => {
    assert.equal(isUuid("EB0CA262-F21C-4A2D-96EE-E2BCD13A3081"), true);
  });

  it("rejects the shelf names someone would guess in a URL", () => {
    // This is the actual bug: /?shelf=cooked made Postgres raise, and the
    // error text — full SQL plus the signed-in user's id — reached the page.
    for (const guess of ["cooked", "cooking", "want_to_cook", "all", "1"]) {
      assert.equal(isUuid(guess), false, `${guess} is not a uuid`);
    }
  });

  it("rejects things that are nearly a uuid", () => {
    assert.equal(isUuid("eb0ca262-f21c-4a2d-96ee-e2bcd13a308"), false, "too short");
    assert.equal(isUuid("eb0ca262-f21c-4a2d-96ee-e2bcd13a3081x"), false, "too long");
    assert.equal(isUuid("eb0ca262f21c4a2d96eee2bcd13a3081"), false, "no dashes");
    assert.equal(isUuid("gb0ca262-f21c-4a2d-96ee-e2bcd13a3081"), false, "not hex");
  });

  it("rejects anything that isn't a string", () => {
    assert.equal(isUuid(null), false);
    assert.equal(isUuid(undefined), false);
    assert.equal(isUuid(42), false);
    assert.equal(isUuid({}), false);
  });

  it("doesn't match a uuid buried in something longer", () => {
    // Anchored, so an id with a payload stapled to it isn't waved through.
    assert.equal(isUuid("eb0ca262-f21c-4a2d-96ee-e2bcd13a3081 OR 1=1"), false);
    assert.equal(isUuid("  eb0ca262-f21c-4a2d-96ee-e2bcd13a3081  "), false);
  });
});

describe("uuidOrUndefined", () => {
  it("passes a real id through", () => {
    assert.equal(uuidOrUndefined("eb0ca262-f21c-4a2d-96ee-e2bcd13a3081"), "eb0ca262-f21c-4a2d-96ee-e2bcd13a3081");
  });

  it("turns nonsense into nothing, so a caller sees one absent case", () => {
    assert.equal(uuidOrUndefined("cooked"), undefined);
    assert.equal(uuidOrUndefined(null), undefined);
    assert.equal(uuidOrUndefined(""), undefined);
  });
});
