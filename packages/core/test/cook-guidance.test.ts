import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  actionCueForStep,
  ingredientAmountsByStep,
  stepSwipeDelta,
  techniquesForStep,
} from "../src/cook-guidance.js";
import type { Ingredient, Step } from "../src/recipe.js";

const ingredient = (item: string, quantity: number | null, notes: string | null = null): Ingredient => ({
  raw: `${quantity ?? ""} cup ${item}`.trim(),
  quantity,
  quantityMax: null,
  unit: "cup",
  item,
  canonicalItem: item,
  notes,
  optional: false,
  group: null,
});

const step = (n: number, text: string): Step => ({ n, text, timerSeconds: null, sourceTimestamp: null });

describe("cook step guidance", () => {
  it("turns the main instruction into a visual action cue", () => {
    assert.deepEqual(actionCueForStep("Whisk the flour and sugar."), { symbol: "↻", label: "Mix and combine" });
    assert.equal(actionCueForStep("Braise until tender.").label, "Cook with heat");
  });

  it("finds multiple complex techniques without a network lookup", () => {
    assert.deepEqual(techniquesForStep("Blanch the beans, then deglaze the pan.").map((value) => value.id), ["blanch", "deglaze"]);
    assert.match(techniquesForStep("Braise the vegetables.")[0]!.meaning, /cook it slowly/i);
  });

  it("puts ordinary recipe amounts on the step", () => {
    const amounts = ingredientAmountsByStep([step(1, "Add the sugar and flour.")], [
      ingredient("sugar", 1),
      ingredient("flour", 2),
    ]).get(1)!;
    assert.deepEqual(amounts.map(({ amount }) => amount), ["1 cup", "2 cups"]);
  });

  it("calculates a stated fraction and the exact remainder of a divided total", () => {
    const butter = ingredient("butter", 1, "divided");
    const amounts = ingredientAmountsByStep([
      step(1, "Melt half the butter."),
      step(2, "Stir in the remaining butter."),
    ], [butter]);
    assert.deepEqual(amounts.get(1)![0], {
      ingredient: butter,
      amount: "½ cup",
      context: "Half of 1 cup total",
      exact: true,
    });
    assert.equal(amounts.get(2)![0]!.amount, "½ cup");
    assert.equal(amounts.get(2)![0]!.exact, true);
  });

  it("does not invent the share of an ambiguously divided ingredient", () => {
    const sugar = ingredient("sugar", 2, "divided");
    const amounts = ingredientAmountsByStep([
      step(1, "Add some sugar."),
      step(2, "Add the remaining sugar."),
    ], [sugar]);
    assert.equal(amounts.get(1)![0]!.amount, "2 cups total");
    assert.equal(amounts.get(1)![0]!.exact, false);
    assert.equal(amounts.get(2)![0]!.amount, "Remaining");
    assert.equal(amounts.get(2)![0]!.exact, false);
  });

  it("does not apply an unrelated fraction elsewhere in the instruction", () => {
    const butter = ingredient("butter", 1, "divided");
    const amount = ingredientAmountsByStep([
      step(1, "Divide the dough in half, then add the butter."),
    ], [butter]).get(1)![0]!;
    assert.equal(amount.amount, "1 cup total");
    assert.equal(amount.exact, false);
  });

  it("accepts only a deliberate horizontal swipe", () => {
    assert.equal(stepSwipeDelta({ x: 200, y: 20 }, { x: 100, y: 25 }), 1);
    assert.equal(stepSwipeDelta({ x: 100, y: 20 }, { x: 190, y: 15 }), -1);
    assert.equal(stepSwipeDelta({ x: 100, y: 20 }, { x: 50, y: 22 }), 0);
    assert.equal(stepSwipeDelta({ x: 100, y: 20 }, { x: 20, y: 140 }), 0);
  });
});
