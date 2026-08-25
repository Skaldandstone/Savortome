import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canEdit, canView, isShared, sharePath, shareUrl } from "../src/sharing.js";
import type { Visibility } from "../src/shelves.js";

const OWNER = "owner-1";
const FRIEND = "friend-1";
const STRANGER = "stranger-1";

const recipe = (visibility: Visibility) => ({ ownerId: OWNER, visibility });

const asOwner = { viewerId: OWNER };
const asFriend = { viewerId: FRIEND, friendIds: new Set([OWNER]) };
const asStranger = { viewerId: STRANGER, friendIds: new Set<string>() };
const signedOut = { viewerId: null };

describe("canView", () => {
  it("always lets the owner see their own", () => {
    for (const v of ["private", "friends", "public"] as Visibility[]) {
      assert.equal(canView(recipe(v), asOwner), true, `owner should see ${v}`);
    }
  });

  it("keeps a private recipe private from everyone else", () => {
    assert.equal(canView(recipe("private"), asFriend), false);
    assert.equal(canView(recipe("private"), asStranger), false);
    assert.equal(canView(recipe("private"), signedOut), false);
  });

  it("shows a public recipe to anyone, including signed out", () => {
    assert.equal(canView(recipe("public"), asStranger), true);
    assert.equal(canView(recipe("public"), signedOut), true);
  });

  it("shows a friends-only recipe to friends and nobody else", () => {
    assert.equal(canView(recipe("friends"), asFriend), true);
    assert.equal(canView(recipe("friends"), asStranger), false);
  });

  it("never leaks a friends-only recipe to a signed-out link visitor", () => {
    // The case that matters: having the URL is not the same as being a friend.
    assert.equal(canView(recipe("friends"), signedOut), false);
    assert.equal(canView(recipe("friends"), { viewerId: null, friendIds: new Set([OWNER]) }), false);
  });
});

describe("canEdit", () => {
  it("is the owner and nobody else", () => {
    assert.equal(canEdit(recipe("public"), asOwner), true);
    assert.equal(canEdit(recipe("public"), asFriend), false);
    assert.equal(canEdit(recipe("public"), signedOut), false);
  });
});

describe("isShared", () => {
  it("counts anything not private as shared", () => {
    assert.equal(isShared("private"), false);
    assert.equal(isShared("friends"), true);
    assert.equal(isShared("public"), true);
  });
});

describe("share links", () => {
  it("builds a path and a full URL", () => {
    assert.equal(sharePath("abc"), "/r/abc");
    assert.equal(shareUrl("abc", "https://nomnom.app"), "https://nomnom.app/r/abc");
  });

  it("tolerates a trailing slash on the origin", () => {
    assert.equal(shareUrl("abc", "https://nomnom.app/"), "https://nomnom.app/r/abc");
  });
});
