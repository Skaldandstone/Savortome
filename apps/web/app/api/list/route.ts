import {
  addItemsToList,
  addRecipesToList,
  clearShoppingList,
  currentShoppingList,
  getShoppingList,
} from "@seconds/db";
import { BadRequestError, withUser } from "@/lib/api";
import { boundedJson } from "@/lib/bounded-json";
import { isUuid } from "@seconds/core/format";

export const runtime = "nodejs";
const privateResponse = (response: Response) => { response.headers.set("Cache-Control", "private, no-store"); return response; };

export async function GET() {
  return privateResponse(await withUser(async (userId, database) => {
    const listId = await currentShoppingList(database, userId);
    return getShoppingList(database, userId, listId);
  }, { redactUnexpectedErrors: true }));
}

/**
 * Two ways in: whole recipes (merged and pantry-adjusted), or loose items —
 * typically the "missing" list from a pantry match.
 */
export async function POST(request: Request) {
  return privateResponse(await withUser(async (userId, database) => {
    const body = await boundedJson(request, 65_536) as {
      recipeIds: string[];
      items: { canonicalItem: string; displayName?: string }[];
      skipStaples: boolean;
      skipOptional: boolean;
      usePantry: boolean;
    };
    if (body.recipeIds !== undefined && (
      !Array.isArray(body.recipeIds) || body.recipeIds.length > 100 || !body.recipeIds.every(isUuid)
    )) {
      throw new BadRequestError("Choose up to 100 saved recipes with valid recipe links.");
    }
    for (const value of [body.skipStaples, body.skipOptional, body.usePantry]) {
      if (value !== undefined && typeof value !== "boolean") {
        throw new BadRequestError("Choose yes or no for the shopping-list options.");
      }
    }
    if (body.items !== undefined && (!Array.isArray(body.items) || body.items.length > 100 || body.items.some(item => !item || typeof item.canonicalItem !== "string" || !item.canonicalItem.trim() || item.canonicalItem.length > 200 || (item.displayName !== undefined && (typeof item.displayName !== "string" || !item.displayName.trim() || item.displayName.length > 200))))) {
      throw new BadRequestError("Choose up to 100 ingredient names, with each name under 200 characters.");
    }
    if (body.items?.length) return addItemsToList(database, userId, body.items);

    return addRecipesToList(database, userId, body.recipeIds ?? [], {
      skipStaples: body.skipStaples,
      skipOptional: body.skipOptional,
      usePantry: body.usePantry,
    });
  }, { redactUnexpectedErrors: true }));
}

export async function DELETE() {
  return privateResponse(await withUser(async (userId, database) => {
    const listId = await currentShoppingList(database, userId);
    await clearShoppingList(database, userId, listId);
    return getShoppingList(database, userId, listId);
  }, { redactUnexpectedErrors: true }));
}
