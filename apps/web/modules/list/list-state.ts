import type { ShoppingListView } from "@seconds/core/format";

/** Apply or roll back one checkbox without disturbing server-owned list metadata. */
export function listWithItemChecked(
  list: ShoppingListView | null,
  itemId: string,
  checked: boolean,
): ShoppingListView | null {
  if (!list) return null;
  return {
    ...list,
    items: list.items.map((item) => item.id === itemId ? { ...item, checked } : item),
  };
}
