import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertCanRequest,
  describeFeedItem,
  FriendshipError,
  normalizeHandle,
  relationshipFrom,
  type FeedItem,
} from "../src/friends.js";

describe("normalizeHandle", () => {
  it("accepts the ways people actually type a handle", () => {
    for (const input of ["sam", "@sam", " Sam ", "https://secondbreakfast.app/@sam", "secondbreakfast.app/sam"]) {
      assert.equal(normalizeHandle(input), "sam", `"${input}" should resolve to sam`);
    }
  });

  it("keeps dashes and digits", () => {
    assert.equal(normalizeHandle("@sam-c2"), "sam-c2");
  });

  it("rejects anything that isn't a handle", () => {
    for (const input of ["", "a", "sam!", "sam c", "-sam", "a".repeat(41)]) {
      assert.throws(() => normalizeHandle(input), FriendshipError, `"${input}" should be rejected`);
    }
  });
});

describe("relationshipFrom", () => {
  it("reads both directions to decide", () => {
    assert.equal(relationshipFrom(null, null, true), "self");
    assert.equal(relationshipFrom("accepted", "accepted", false), "friends");
    assert.equal(relationshipFrom("pending", null, false), "request-sent");
    assert.equal(relationshipFrom(null, "pending", false), "request-received");
    assert.equal(relationshipFrom("blocked", null, false), "blocked");
    assert.equal(relationshipFrom(null, null, false), "none");
  });

  it("treats one accepted side as friends, so a half-written pair still reads right", () => {
    assert.equal(relationshipFrom("accepted", null, false), "friends");
    assert.equal(relationshipFrom(null, "accepted", false), "friends");
  });

  it("puts self before everything, so you can never act on yourself", () => {
    assert.equal(relationshipFrom("accepted", "accepted", true), "self");
  });

  it("puts blocking ahead of any pending request", () => {
    assert.equal(relationshipFrom("blocked", "pending", false), "blocked");
  });
});

describe("assertCanRequest", () => {
  it("allows a request only when there's no relationship yet", () => {
    assert.doesNotThrow(() => assertCanRequest("none"));
  });

  it("refuses every other state with a reason worth showing", () => {
    for (const state of ["self", "friends", "request-sent", "request-received", "blocked"] as const) {
      assert.throws(() => assertCanRequest(state), FriendshipError, `${state} should be refused`);
    }
  });

  it("points at accepting when they already asked you", () => {
    assert.throws(() => assertCanRequest("request-received"), /accept instead/i);
  });
});

describe("describeFeedItem", () => {
  const base: FeedItem = {
    kind: "cooked",
    person: { id: "1", handle: "sam", displayName: "Sam", avatarUrl: null },
    recipeId: "r",
    recipeTitle: "Chili",
    recipeImageUrl: null,
    at: "2026-08-25T00:00:00.000Z",
  };

  it("says what happened, in past tense", () => {
    assert.equal(describeFeedItem({ ...base, timesCooked: 1 }), "Sam cooked this");
    assert.equal(describeFeedItem({ ...base, timesCooked: 3 }), "Sam cooked this again");
    assert.equal(describeFeedItem({ ...base, kind: "rated", stars: 4 }), "Sam rated it 4/5");
    assert.equal(describeFeedItem({ ...base, kind: "shared" }), "Sam shared this");
  });
});
