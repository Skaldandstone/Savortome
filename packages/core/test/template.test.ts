import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TEMPLATE_ROLES, templateSharePath, templateShareUrl } from "../src/template.js";

describe("TEMPLATE_ROLES", () => {
  it("puts main first, so a role list always sorts main ahead of its pairings", () => {
    assert.equal(TEMPLATE_ROLES[0], "main");
  });

  it("has exactly the four roles a full meal uses", () => {
    assert.deepEqual([...TEMPLATE_ROLES].sort(), ["dessert", "drink", "main", "side"]);
  });
});

describe("templateSharePath / templateShareUrl", () => {
  it("builds a relative path under /t", () => {
    assert.equal(templateSharePath("abc-123"), "/t/abc-123");
  });

  it("joins an origin without a double slash", () => {
    assert.equal(templateShareUrl("abc-123", "https://example.com"), "https://example.com/t/abc-123");
    assert.equal(templateShareUrl("abc-123", "https://example.com/"), "https://example.com/t/abc-123");
  });
});
