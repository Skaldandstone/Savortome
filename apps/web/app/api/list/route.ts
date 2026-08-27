import {
  addItemsToList,
  addRecipesToList,
  clearShoppingList,
  currentShoppingList,
  getShoppingList,
} from "@seconds/db";
import { readJson, withUser } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  return withUser(async (userId, database) => {
    const listId = await currentShoppingList(database, userId);
    return getShoppingList(database, userId, listId);
  });
}

/**
 * Two ways in: whole recipes (merged and pantry-adjusted), or loose items —
 * typically the "missing" list from a pantry match.
 */
export async function POST(request: Request) {
  const body = await readJson<{
    recipeIds: string[];
    items: { canonicalItem: string; displayName?: string }[];
    skipStaples: boolean;
    skipOptional: boolean;
    usePantry: boolean;
  }>(request);

  return withUser((userId, database) => {
    if (body.items?.length) return addItemsToList(database, userId, body.items);

    return addRecipesToList(database, userId, body.recipeIds ?? [], {
      skipStaples: body.skipStaples,
      skipOptional: body.skipOptional,
      usePantry: body.usePantry,
    });
  });
}

export async function DELETE() {
  return withUser(async (userId, database) => {
    const listId = await currentShoppingList(database, userId);
    await clearShoppingList(database, userId, listId);
    return getShoppingList(database, userId, listId);
  });
}
