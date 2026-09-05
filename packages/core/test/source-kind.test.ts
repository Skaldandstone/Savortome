import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { youtubeVideoId, socialKind, detectSourceKind } from "../src/source-kind.js";

describe("youtubeVideoId", () => {
  it("reads the v param from a watch URL", () => {
    assert.equal(youtubeVideoId("https://www.youtube.com/watch?v=abc123"), "abc123");
  });

  it("reads a youtu.be short link", () => {
    assert.equal(youtubeVideoId("https://youtu.be/abc123"), "abc123");
  });

  it("does not match a lookalike domain", () => {
    assert.equal(youtubeVideoId("https://evilyoutube.com/watch?v=abc123"), null);
    assert.equal(youtubeVideoId("https://notyoutube.com/watch?v=abc123"), null);
    assert.equal(youtubeVideoId("https://youtube.com.attacker.net/watch?v=abc123"), null);
  });

  it("matches a genuine subdomain", () => {
    assert.equal(youtubeVideoId("https://m.youtube.com/watch?v=abc123"), "abc123");
  });
});

describe("socialKind", () => {
  it("classifies known platforms", () => {
    assert.equal(socialKind("https://www.tiktok.com/@user/video/1"), "tiktok");
    assert.equal(socialKind("https://www.instagram.com/p/abc/"), "instagram");
    assert.equal(socialKind("https://www.facebook.com/watch?v=1"), "facebook");
  });

  it("does not match a lookalike domain", () => {
    assert.equal(socialKind("https://xtiktok.com/@user/video/1"), null);
    assert.equal(socialKind("https://notinstagram.com/p/abc/"), null);
    assert.equal(socialKind("https://facebook.com.attacker.net/watch?v=1"), null);
  });
});

describe("detectSourceKind", () => {
  it("falls back to web for an unrecognized lookalike domain", () => {
    assert.equal(detectSourceKind("https://evilyoutube.com/watch?v=abc123"), "web");
  });
});
