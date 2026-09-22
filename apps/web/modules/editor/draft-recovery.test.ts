import assert from "node:assert/strict";
import test from "node:test";
import { emptyDraft } from "@seconds/core/format";
import { readRecipeDraftRecovery, recipeDraftStorageKey } from "./draft-recovery";

test("restores a structurally sound unfinished recipe draft", () => {
  const draft = emptyDraft();
  draft.title = "A half-finished idea";
  assert.deepEqual(readRecipeDraftRecovery(JSON.stringify({ draft, savedAt: 10 })), draft);
});

test("rejects malformed JSON and malformed nested recipe fields", () => {
  const draft = emptyDraft();
  for (const raw of [
    null,
    "{",
    "[]",
    JSON.stringify({ draft: { ...draft, ingredients: "flour" } }),
    JSON.stringify({ draft: { ...draft, ingredients: [{ ...draft.ingredients[0], optional: "no" }] } }),
    JSON.stringify({ draft: { ...draft, steps: [{ ...draft.steps[0], timerSeconds: "soon" }] } }),
  ]) assert.equal(readRecipeDraftRecovery(raw), null);
});

test("keeps new and existing recipes separate inside an opaque account scope", () => {
  assert.equal(recipeDraftStorageKey("d01e52c11f5a", null), "savortome:recipe-draft:v1:d01e52c11f5a:new");
  assert.equal(recipeDraftStorageKey("d01e52c11f5a", "recipe-7"), "savortome:recipe-draft:v1:d01e52c11f5a:recipe-7");
});
