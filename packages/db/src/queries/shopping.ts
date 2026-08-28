import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  buildShoppingList,
  pantryMayCover,
  type CartHandoff,
  type Ingredient,
  type PantryEntry,
  type ShoppingLine,
} from "@seconds/core";
import type { Database } from "../client.js";
import * as schema from "../schema.js";
import { listPantry } from "./pantry.js";

/**
 * Shopping lists.
 *
 * Merging is done in `@seconds/core` so the rules are testable without a
 * database; this layer is about persistence — which recipes went in, what has
 * been ticked off, and where the list was sent.
 */

export interface ShoppingListSummary {
  id: string;
  name: string;
  createdAt: string;
  itemCount: number;
  checkedCount: number;
}

export interface ShoppingListDetail extends ShoppingListSummary {
  items: (ShoppingLine & { id: string })[];
}

function toLine(
  row: typeof schema.shoppingListItems.$inferSelect,
  pantry: PantryEntry[],
): ShoppingLine & { id: string } {
  const line: ShoppingLine & { id: string } = {
    id: row.id,
    canonicalItem: row.canonicalItem,
    displayName: row.displayName,
    quantity: row.quantity,
    unit: row.unit,
    recipeIds: row.recipeIds,
    // An unstated amount is exactly a null quantity, so it needs no column.
    amountUnknown: row.quantity === null,
    mayAlreadyHave: false,
    checked: row.checked,
  };

  // Recomputed on read rather than stored: the pantry changes after a list is
  // built, and a stale "you may already have some" is worse than none.
  return { ...line, mayAlreadyHave: pantryMayCover(line, pantry) };
}

export async function listShoppingLists(
  database: Database,
  userId: string,
): Promise<ShoppingListSummary[]> {
  const lists = await database.query.shoppingLists.findMany({
    where: eq(schema.shoppingLists.userId, userId),
    orderBy: [desc(schema.shoppingLists.createdAt)],
  });
  if (lists.length === 0) return [];

  const items = await database
    .select({
      listId: schema.shoppingListItems.listId,
      checked: schema.shoppingListItems.checked,
    })
    .from(schema.shoppingListItems)
    .where(
      inArray(
        schema.shoppingListItems.listId,
        lists.map((l) => l.id),
      ),
    );

  return lists.map((list) => {
    const own = items.filter((i) => i.listId === list.id);
    return {
      id: list.id,
      name: list.name,
      createdAt: list.createdAt.toISOString(),
      itemCount: own.length,
      checkedCount: own.filter((i) => i.checked).length,
    };
  });
}

export async function getShoppingList(
  database: Database,
  userId: string,
  listId: string,
): Promise<ShoppingListDetail | null> {
  const list = await database.query.shoppingLists.findFirst({
    where: and(eq(schema.shoppingLists.id, listId), eq(schema.shoppingLists.userId, userId)),
  });
  if (!list) return null;

  const [rows, pantry] = await Promise.all([
    database.query.shoppingListItems.findMany({
      where: eq(schema.shoppingListItems.listId, listId),
      orderBy: (i, { asc }) => [asc(i.displayName)],
    }),
    listPantry(database, userId),
  ]);

  return {
    id: list.id,
    name: list.name,
    createdAt: list.createdAt.toISOString(),
    itemCount: rows.length,
    checkedCount: rows.filter((r) => r.checked).length,
    items: rows.map((row) => toLine(row, pantry)),
  };
}

/** The list a new addition goes onto: the newest one, or a fresh one. */
export async function currentShoppingList(
  database: Database,
  userId: string,
): Promise<string> {
  const existing = await database.query.shoppingLists.findFirst({
    where: eq(schema.shoppingLists.userId, userId),
    orderBy: [desc(schema.shoppingLists.createdAt)],
    columns: { id: true },
  });
  if (existing) return existing.id;

  const [created] = await database
    .insert(schema.shoppingLists)
    .values({ userId, name: "Shopping list" })
    .returning({ id: schema.shoppingLists.id });
  return created!.id;
}

export interface AddToListOptions {
  /** Leave staples off. Most people don't shop for salt. */
  skipStaples?: boolean;
  skipOptional?: boolean;
  /** Subtract what the kitchen already holds. */
  usePantry?: boolean;
}

/**
 * Add recipes to a list, merging with whatever is already on it.
 *
 * Merging happens over the union of existing items and new ingredients, so
 * adding a second recipe that also needs flour updates the flour line rather
 * than adding a second one.
 */
export async function addRecipesToList(
  database: Database,
  userId: string,
  recipeIds: string[],
  options: AddToListOptions = {},
): Promise<ShoppingListDetail> {
  const { skipStaples = true, skipOptional = true, usePantry = true } = options;
  const listId = await currentShoppingList(database, userId);

  const recipes = await database.query.recipes.findMany({
    where: and(eq(schema.recipes.ownerId, userId), inArray(schema.recipes.id, recipeIds)),
    columns: { id: true, ingredients: true },
  });

  const byRecipe = new Map<string, Ingredient[]>(recipes.map((r) => [r.id, r.ingredients]));

  // Existing items rejoin the merge as pseudo-ingredients so quantities add up
  // instead of the list growing a duplicate line per recipe.
  const existing = await database.query.shoppingListItems.findMany({
    where: eq(schema.shoppingListItems.listId, listId),
  });

  if (existing.length > 0) {
    byRecipe.set(
      "__existing__",
      existing.map((row) => ({
        raw: row.displayName,
        quantity: row.quantity,
        quantityMax: null,
        unit: row.unit,
        item: row.displayName,
        canonicalItem: row.canonicalItem,
        notes: null,
        optional: false,
        group: null,
      })),
    );
  }

  const pantry = usePantry ? await listPantry(database, userId) : [];
  const lines = buildShoppingList(byRecipe, { pantry, skipStaples, skipOptional });

  if (lines.length === 0) {
    await database
      .delete(schema.shoppingListItems)
      .where(eq(schema.shoppingListItems.listId, listId));
    return (await getShoppingList(database, userId, listId))!;
  }

  // Ticked-off items stay ticked when the list is rebuilt.
  const wasChecked = new Set(existing.filter((e) => e.checked).map((e) => e.canonicalItem));

  await database.transaction(async (tx) => {
    await tx
      .delete(schema.shoppingListItems)
      .where(eq(schema.shoppingListItems.listId, listId));
    await tx.insert(schema.shoppingListItems).values(
      lines.map((line) => ({
        listId,
        canonicalItem: line.canonicalItem,
        displayName: line.displayName,
        quantity: line.quantity,
        unit: line.unit,
        // The synthetic id used to fold existing items back in isn't a recipe.
        recipeIds: line.recipeIds.filter((id) => id !== "__existing__"),
        checked: wasChecked.has(line.canonicalItem),
      })),
    );
  });

  return (await getShoppingList(database, userId, listId))!;
}

/** Add loose items — typically the "missing" list from a pantry match. */
export async function addItemsToList(
  database: Database,
  userId: string,
  items: { canonicalItem: string; displayName?: string }[],
): Promise<ShoppingListDetail> {
  const listId = await currentShoppingList(database, userId);

  if (items.length > 0) {
    await database
      .insert(schema.shoppingListItems)
      .values(
        items.map((item) => ({
          listId,
          canonicalItem: item.canonicalItem,
          displayName: item.displayName ?? item.canonicalItem,
          quantity: null,
          unit: null,
          recipeIds: [],
        })),
      )
      .onConflictDoUpdate({
        target: [schema.shoppingListItems.listId, schema.shoppingListItems.canonicalItem],
        // Already on the list: keep whatever amount is there rather than
        // wiping a merged quantity with a blank one.
        set: { displayName: sql`excluded.display_name` },
      });
  }

  return (await getShoppingList(database, userId, listId))!;
}

/** An item is only reachable through a list its owner holds. */
async function ownsItem(
  database: Database,
  userId: string,
  itemId: string,
): Promise<boolean> {
  const rows = await database
    .select({ id: schema.shoppingListItems.id })
    .from(schema.shoppingListItems)
    .innerJoin(
      schema.shoppingLists,
      eq(schema.shoppingLists.id, schema.shoppingListItems.listId),
    )
    .where(and(eq(schema.shoppingListItems.id, itemId), eq(schema.shoppingLists.userId, userId)));
  return rows.length > 0;
}

export async function setItemChecked(
  database: Database,
  userId: string,
  itemId: string,
  checked: boolean,
): Promise<void> {
  if (!(await ownsItem(database, userId, itemId))) return;

  await database
    .update(schema.shoppingListItems)
    .set({ checked })
    .where(eq(schema.shoppingListItems.id, itemId));
}

export async function removeListItem(
  database: Database,
  userId: string,
  itemId: string,
): Promise<void> {
  if (!(await ownsItem(database, userId, itemId))) return;
  await database.delete(schema.shoppingListItems).where(eq(schema.shoppingListItems.id, itemId));
}

export async function clearShoppingList(
  database: Database,
  userId: string,
  listId: string,
): Promise<void> {
  const list = await database.query.shoppingLists.findFirst({
    where: and(eq(schema.shoppingLists.id, listId), eq(schema.shoppingLists.userId, userId)),
    columns: { id: true },
  });
  if (!list) return;
  await database.delete(schema.shoppingListItems).where(eq(schema.shoppingListItems.listId, listId));
}

/** Record where a list was sent, so the history reads the same for every provider. */
export async function recordCartHandoff(
  database: Database,
  listId: string,
  handoff: CartHandoff,
): Promise<void> {
  await database.insert(schema.cartHandoffs).values({
    listId,
    provider: handoff.provider,
    handoffUrl: handoff.url,
    unmatchedItems: handoff.unmatched,
  });
}
