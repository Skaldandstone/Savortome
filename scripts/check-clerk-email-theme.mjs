import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const template = readFileSync(
  new URL("../docs/beta/clerk-email-theme/new-device-sign-in.html", import.meta.url),
  "utf8",
);

test("new-device email preserves Clerk security fields and recovery action", () => {
  for (const variable of [
    "{{> app_logo}}",
    "{{app.name}}",
    "{{sign_in_method}}",
    "{{browser_name}}",
    "{{operating_system}}",
    "{{location}}",
    "{{ip_address}}",
    "{{session_created_at}}",
    "{{revoke_session_url}}",
  ]) {
    assert.match(template, new RegExp(variable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(template, /href="\{\{revoke_session_url\}\}"/);
  assert.match(template, /Sign out this device/);
});

test("new-device email uses the Savortome palette without remote tracking content", () => {
  assert.match(template, /#1d140f/i);
  assert.match(template, /#fbf1dd/i);
  assert.match(template, /#a87a36/i);
  assert.doesNotMatch(template, /<img\b/i);
  assert.doesNotMatch(template, /(?:src\s*=|url\()["']?https?:\/\//i);
  assert.doesNotMatch(template, /pixel|tracking/i);
});
