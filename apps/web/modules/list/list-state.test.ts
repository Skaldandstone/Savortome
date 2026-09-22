import assert from "node:assert/strict";
import test from "node:test";
import type { ShoppingListView } from "@seconds/core/format";
import { listWithItemChecked } from "./list-state";

const list: ShoppingListView = {
  id: "list-1",
  name: "Shopping list",
  createdAt: "2026-09-22T00:00:00.000Z",
  itemCount: 1,
  checkedCount: 0,
  items: [{
    id: "item-1",
    canonicalItem: "banana",
    displayName: "bananas",
    quantity: 6,
    unit: null,
    amountUnknown: false,
    checked: false,
    mayAlreadyHave: false,
    recipeIds: [],
  }],
};

test("a checked item can be rolled back after a rejected write", () => {
  const optimistic = listWithItemChecked(list, "item-1", true)!;
  const rolledBack = listWithItemChecked(optimistic, "item-1", false)!;
  assert.equal(optimistic.items[0]?.checked, true);
  assert.equal(rolledBack.items[0]?.checked, false);
  assert.equal(list.items[0]?.checked, false, "the prior state stays available for recovery");
});

test("missing lists and unrelated items stay unchanged in meaning", () => {
  assert.equal(listWithItemChecked(null, "item-1", true), null);
  assert.deepEqual(listWithItemChecked(list, "missing", true), list);
});
