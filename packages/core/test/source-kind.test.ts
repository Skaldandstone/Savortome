import { describe, it, expect } from "vitest";
import { youtubeVideoId, socialKind, detectSourceKind } from "../src/source-kind.js";

describe("youtubeVideoId", () => {
  it("reads the v param from a watch URL", () => {
    expect(youtubeVideoId("https://www.youtube.com/watch?v=abc123")).toBe("abc123");
  });

  it("reads a youtu.be short link", () => {
    expect(youtubeVideoId("https://youtu.be/abc123")).toBe("abc123");
  });

  it("does not match a lookalike domain", () => {
    expect(youtubeVideoId("https://evilyoutube.com/watch?v=abc123")).toBeNull();
    expect(youtubeVideoId("https://notyoutube.com/watch?v=abc123")).toBeNull();
    expect(youtubeVideoId("https://youtube.com.attacker.net/watch?v=abc123")).toBeNull();
  });

  it("matches a genuine subdomain", () => {
    expect(youtubeVideoId("https://m.youtube.com/watch?v=abc123")).toBe("abc123");
  });
});

describe("socialKind", () => {
  it("classifies known platforms", () => {
    expect(socialKind("https://www.tiktok.com/@user/video/1")).toBe("tiktok");
    expect(socialKind("https://www.instagram.com/p/abc/")).toBe("instagram");
    expect(socialKind("https://www.facebook.com/watch?v=1")).toBe("facebook");
  });

  it("does not match a lookalike domain", () => {
    expect(socialKind("https://xtiktok.com/@user/video/1")).toBeNull();
    expect(socialKind("https://notinstagram.com/p/abc/")).toBeNull();
    expect(socialKind("https://facebook.com.attacker.net/watch?v=1")).toBeNull();
  });
});

describe("detectSourceKind", () => {
  it("falls back to web for an unrecognized lookalike domain", () => {
    expect(detectSourceKind("https://evilyoutube.com/watch?v=abc123")).toBe("web");
  });
});
