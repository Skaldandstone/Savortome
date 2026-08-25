import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  blankStep,
  emptyDraft,
  ingredientFromLine,
  moveItem,
  normalizeDraft,
  provenanceTone,
  RecipeValidationError,
  validateDraft,
  type RecipeDraft,
} from "../src/editor.js";

const draftWith = (patch: Partial<RecipeDraft> = {}): RecipeDraft => ({
  ...emptyDraft(),
  title: "Chili",
  ingredients: [ingredientFromLine("2 tbsp olive oil")],
  steps: [{ ...blankStep(1), text: "Cook it." }],
  ...patch,
});

describe("ingredientFromLine", () => {
  it("splits a typed line the same way the importer does", () => {
    const ing = ingredientFromLine("2 tbsp olive oil");
    assert.equal(ing.quantity, 2);
    assert.equal(ing.unit, "tbsp");
    assert.equal(ing.item, "olive oil");
    assert.equal(ing.canonicalItem, "olive oil");
  });

  it("keeps prep after the comma as a note", () => {
    const ing = ingredientFromLine("1 large yellow onion, finely diced");
    assert.equal(ing.notes, "finely diced");
    assert.equal(ing.canonicalItem, "yellow onion");
  });

  it("handles a bare name with no amount", () => {
    const ing = ingredientFromLine("salt");
    assert.equal(ing.quantity, null);
    assert.equal(ing.canonicalItem, "salt");
  });

  it("gives a blank line a blank ingredient rather than junk", () => {
    assert.equal(ingredientFromLine("   ").item, "");
  });

  it("carries the group through", () => {
    assert.equal(ingredientFromLine("1 cup milk", "For the sauce").group, "For the sauce");
  });
});

describe("normalizeDraft", () => {
  it("recomputes the canonical name from the edited item", () => {
    // The case that matters: correcting a name must move the key with it, or
    // the recipe silently stops matching pantry search.
    const draft = draftWith({
      ingredients: [{ ...ingredientFromLine("2 tbsp olive oil"), item: "Sesame Oils", canonicalItem: "olive oil" }],
    });
    assert.equal(normalizeDraft(draft).ingredients[0]!.canonicalItem, "sesame oil");
  });

  it("drops empty ingredients and steps", () => {
    const draft = draftWith({
      ingredients: [ingredientFromLine("rice"), ingredientFromLine("  ")],
      steps: [{ ...blankStep(1), text: "Cook." }, blankStep(2)],
    });
    const clean = normalizeDraft(draft);
    assert.equal(clean.ingredients.length, 1);
    assert.equal(clean.steps.length, 1);
  });

  it("renumbers steps after a deletion", () => {
    const draft = draftWith({
      steps: [
        { ...blankStep(1), text: "One." },
        blankStep(2),
        { ...blankStep(3), text: "Three." },
      ],
    });
    assert.deepEqual(normalizeDraft(draft).steps.map((s) => s.n), [1, 2]);
  });

  it("reads a timer out of what the step says", () => {
    const draft = draftWith({
      steps: [{ ...blankStep(1), text: "Simmer gently for 20 minutes." }],
    });
    assert.equal(normalizeDraft(draft).steps[0]!.timerSeconds, 1200);
  });

  it("follows the text when it changes, and keeps what was there when it can't", () => {
    // An edited duration has to move the timer with it, or the card quietly
    // disagrees with itself.
    const edited = draftWith({
      steps: [{ ...blankStep(1), text: "Simmer for 30 minutes.", timerSeconds: 1200 }],
    });
    assert.equal(normalizeDraft(edited).steps[0]!.timerSeconds, 1800);

    // Nothing in the words to go on: a timer the extractor got from watching
    // the video survives.
    const silent = draftWith({
      steps: [{ ...blankStep(1), text: "Fry until golden.", timerSeconds: 240 }],
    });
    assert.equal(normalizeDraft(silent).steps[0]!.timerSeconds, 240);
  });

  it("cleans up tags", () => {
    const draft = draftWith({ tags: [" #Weeknight ", "weeknight", "QUICK", "  "] });
    assert.deepEqual(normalizeDraft(draft).tags, ["weeknight", "quick"]);
  });

  it("derives a total time only when one wasn't given", () => {
    assert.equal(normalizeDraft(draftWith({ prepMinutes: 10, cookMinutes: 20 })).totalMinutes, 30);
    assert.equal(
      normalizeDraft(draftWith({ prepMinutes: 10, cookMinutes: 20, totalMinutes: 45 })).totalMinutes,
      45,
    );
    assert.equal(normalizeDraft(draftWith({ prepMinutes: 10 })).totalMinutes, null);
  });

  it("turns blank text into null rather than empty strings", () => {
    const clean = normalizeDraft(draftWith({ description: "   ", cuisine: "", servingsNote: " " }));
    assert.equal(clean.description, null);
    assert.equal(clean.cuisine, null);
    assert.equal(clean.servingsNote, null);
  });
});

describe("validateDraft", () => {
  it("accepts a complete recipe", () => {
    assert.doesNotThrow(() => validateDraft(draftWith()));
  });

  it("insists on a name", () => {
    assert.throws(() => validateDraft(draftWith({ title: "  " })), RecipeValidationError);
  });

  it("insists on at least one ingredient and one step", () => {
    assert.throws(() => validateDraft(draftWith({ ingredients: [] })), /ingredient/i);
    assert.throws(() => validateDraft(draftWith({ steps: [] })), /step/i);
  });

  it("ignores blank rows when counting", () => {
    assert.throws(
      () => validateDraft(draftWith({ ingredients: [ingredientFromLine("  ")] })),
      /ingredient/i,
    );
  });

  it("rejects negative times", () => {
    assert.throws(() => validateDraft(draftWith({ prepMinutes: -5 })), /negative/i);
  });

  it("says which field is wrong, so the cursor can go there", () => {
    try {
      validateDraft(draftWith({ title: "" }));
      assert.fail("should have thrown");
    } catch (err) {
      assert.equal((err as RecipeValidationError).field, "title");
    }
  });
});

describe("moveItem", () => {
  it("reorders", () => {
    assert.deepEqual(moveItem(["a", "b", "c"], 0, 2), ["b", "c", "a"]);
    assert.deepEqual(moveItem(["a", "b", "c"], 2, 0), ["c", "a", "b"]);
  });

  it("does nothing when the move is a no-op or out of range", () => {
    assert.deepEqual(moveItem(["a", "b"], 1, 1), ["a", "b"]);
    assert.deepEqual(moveItem(["a", "b"], 0, 5), ["a", "b"]);
    assert.deepEqual(moveItem(["a", "b"], -1, 0), ["a", "b"]);
  });

  it("leaves the caller's array untouched", () => {
    const input = ["a", "b", "c"];
    moveItem(input, 0, 2);
    assert.deepEqual(input, ["a", "b", "c"]);
  });
});

describe("provenanceTone", () => {
  it("warns about a shaky extraction", () => {
    assert.equal(provenanceTone(0.5, 0, null), "needs-review");
    assert.equal(provenanceTone(1, 2, null), "needs-review");
  });

  it("says nothing about a clean one", () => {
    assert.equal(provenanceTone(1, 0, null), "fine");
  });

  it("stops warning once a person has checked it", () => {
    // The history stays on the record; it just isn't a warning any more.
    assert.equal(provenanceTone(0.4, 5, "2026-08-25T00:00:00.000Z"), "verified");
  });
});
