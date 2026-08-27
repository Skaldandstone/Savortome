import { and, count, desc, eq, inArray, ne, sql } from "drizzle-orm";
import {
  isStatusShelf,
  normalizeShelfName,
  ShelfValidationError,
  shouldCountAsCook,
  STATUS_SHELVES,
  type RecipeShelfState,
  type ShelfSummary,
  type StatusShelf,
  type Visibility,
} from "@seconds/core";
import type { Database } from "../client.js";
import * as schema from "../schema.js";

/**
 * Shelf reads and writes.
 *
 * The neon-http driver has no interactive transactions, so multi-statement
 * writes go through `database.batch(...)`, which sends them as one atomic
 * round-trip. Anything that genuinely needs a read between writes is sequenced
 * and written to be idempotent instead.
 */

export async function listShelves(database: Database, userId: string): Promise<ShelfSummary[]> {
  const rows = await database
    .select({
      id: schema.shelves.id,
      name: schema.shelves.name,
      type: schema.shelves.type,
      visibility: schema.shelves.visibility,
      recipeCount: count(schema.shelfRecipes.recipeId),
    })
    .from(schema.shelves)
    .leftJoin(schema.shelfRecipes, eq(schema.shelfRecipes.shelfId, schema.shelves.id))
    .where(eq(schema.shelves.userId, userId))
    .groupBy(schema.shelves.id);

  // Built-in shelves first, in lifecycle order, then custom shelves A-Z.
  const order = new Map<string, number>(STATUS_SHELVES.map((t, i) => [t, i]));
  return rows.sort((a, b) => {
    const rank = (order.get(a.type) ?? 99) - (order.get(b.type) ?? 99);
    return rank !== 0 ? rank : a.name.localeCompare(b.name);
  });
}

async function statusShelfIds(
  database: Database,
  userId: string,
): Promise<Map<StatusShelf, string>> {
  const rows = await database
    .select({ id: schema.shelves.id, type: schema.shelves.type })
    .from(schema.shelves)
    .where(
      and(eq(schema.shelves.userId, userId), inArray(schema.shelves.type, [...STATUS_SHELVES])),
    );
  return new Map(rows.map((r) => [r.type as StatusShelf, r.id]));
}

export async function createShelf(
  database: Database,
  userId: string,
  rawName: string,
): Promise<ShelfSummary> {
  const name = normalizeShelfName(rawName);

  const [created] = await database
    .insert(schema.shelves)
    .values({ userId, name, type: "custom" })
    .onConflictDoNothing()
    .returning({
      id: schema.shelves.id,
      name: schema.shelves.name,
      type: schema.shelves.type,
      visibility: schema.shelves.visibility,
    });

  if (!created) throw new ShelfValidationError(`You already have a shelf called "${name}".`);
  return { ...created, recipeCount: 0 };
}

export async function renameShelf(
  database: Database,
  userId: string,
  shelfId: string,
  rawName: string,
): Promise<void> {
  const name = normalizeShelfName(rawName);
  const updated = await database
    .update(schema.shelves)
    .set({ name })
    .where(
      and(
        eq(schema.shelves.id, shelfId),
        eq(schema.shelves.userId, userId),
        // The built-in three are renamed only by changing the app's copy.
        eq(schema.shelves.type, "custom"),
      ),
    )
    .returning({ id: schema.shelves.id });

  if (updated.length === 0) {
    throw new ShelfValidationError("That shelf can't be renamed.");
  }
}

export async function setShelfVisibility(
  database: Database,
  userId: string,
  shelfId: string,
  visibility: Visibility,
): Promise<void> {
  await database
    .update(schema.shelves)
    .set({ visibility })
    .where(and(eq(schema.shelves.id, shelfId), eq(schema.shelves.userId, userId)));
}

export async function deleteShelf(
  database: Database,
  userId: string,
  shelfId: string,
): Promise<void> {
  const deleted = await database
    .delete(schema.shelves)
    .where(
      and(
        eq(schema.shelves.id, shelfId),
        eq(schema.shelves.userId, userId),
        // Deleting a built-in shelf would strand every recipe's status.
        eq(schema.shelves.type, "custom"),
      ),
    )
    .returning({ id: schema.shelves.id });

  if (deleted.length === 0) {
    throw new ShelfValidationError("The built-in shelves can't be deleted.");
  }
}

/** Which shelves a recipe sits on, plus its rating. Drives every shelf control. */
export async function getRecipeShelfState(
  database: Database,
  userId: string,
  recipeId: string,
): Promise<RecipeShelfState> {
  const [placements, rating] = await Promise.all([
    database
      .select({ shelfId: schema.shelves.id, type: schema.shelves.type })
      .from(schema.shelfRecipes)
      .innerJoin(schema.shelves, eq(schema.shelves.id, schema.shelfRecipes.shelfId))
      .where(and(eq(schema.shelves.userId, userId), eq(schema.shelfRecipes.recipeId, recipeId))),
    database.query.ratings.findFirst({
      where: and(eq(schema.ratings.userId, userId), eq(schema.ratings.recipeId, recipeId)),
    }),
  ]);

  const status = placements.find((p) => isStatusShelf(p.type))?.type as StatusShelf | undefined;

  return {
    shelfIds: placements.map((p) => p.shelfId),
    status: status ?? null,
    rating: rating
      ? {
          stars: rating.stars,
          review: rating.review,
          timesCooked: rating.timesCooked,
          lastCookedAt: rating.lastCookedAt?.toISOString() ?? null,
        }
      : null,
  };
}

/**
 * Move a recipe to a status shelf, or off all of them when `status` is null.
 * The three status shelves are mutually exclusive, so this always clears the
 * others rather than adding alongside them.
 */
export async function setRecipeStatus(
  database: Database,
  userId: string,
  recipeId: string,
  status: StatusShelf | null,
): Promise<RecipeShelfState> {
  const [shelfIds, before] = await Promise.all([
    statusShelfIds(database, userId),
    getRecipeShelfState(database, userId, recipeId),
  ]);

  const statusIds = [...shelfIds.values()];
  if (statusIds.length === 0) throw new ShelfValidationError("This account has no shelves yet.");

  const clear = database
    .delete(schema.shelfRecipes)
    .where(
      and(
        eq(schema.shelfRecipes.recipeId, recipeId),
        inArray(schema.shelfRecipes.shelfId, statusIds),
      ),
    );

  if (status === null) {
    await clear;
    return getRecipeShelfState(database, userId, recipeId);
  }

  const targetId = shelfIds.get(status);
  if (!targetId) throw new ShelfValidationError(`No "${status}" shelf on this account.`);

  await database.batch([
    clear,
    database
      .insert(schema.shelfRecipes)
      .values({ shelfId: targetId, recipeId })
      .onConflictDoNothing(),
  ]);

  // Marking something cooked is the one move with a side effect.
  if (shouldCountAsCook(before.status, status)) {
    await recordCook(database, userId, recipeId);
  }

  return getRecipeShelfState(database, userId, recipeId);
}

/** Bump the times-cooked counter, creating the rating row if this is the first time. */
export async function recordCook(
  database: Database,
  userId: string,
  recipeId: string,
): Promise<void> {
  const now = new Date();
  await database
    .insert(schema.ratings)
    // Stars 0 means "cooked but not rated" — the UI shows an empty star row.
    .values({ userId, recipeId, stars: 0, timesCooked: 1, lastCookedAt: now })
    .onConflictDoUpdate({
      target: [schema.ratings.userId, schema.ratings.recipeId],
      set: {
        timesCooked: sql`${schema.ratings.timesCooked} + 1`,
        lastCookedAt: now,
        updatedAt: now,
      },
    });
}

/** Add or remove a recipe from one custom shelf. */
export async function setCustomShelfMembership(
  database: Database,
  userId: string,
  recipeId: string,
  shelfId: string,
  member: boolean,
): Promise<RecipeShelfState> {
  const shelf = await database.query.shelves.findFirst({
    where: and(eq(schema.shelves.id, shelfId), eq(schema.shelves.userId, userId)),
    columns: { id: true, type: true },
  });
  if (!shelf) throw new ShelfValidationError("That shelf doesn't exist.");
  if (shelf.type !== "custom") {
    throw new ShelfValidationError("Use the status control for the built-in shelves.");
  }

  if (member) {
    await database
      .insert(schema.shelfRecipes)
      .values({ shelfId, recipeId })
      .onConflictDoNothing();
  } else {
    await database
      .delete(schema.shelfRecipes)
      .where(
        and(eq(schema.shelfRecipes.shelfId, shelfId), eq(schema.shelfRecipes.recipeId, recipeId)),
      );
  }

  return getRecipeShelfState(database, userId, recipeId);
}

/** Recipe ids on one shelf, newest addition first. Used to filter the library. */
export async function recipeIdsOnShelf(
  database: Database,
  userId: string,
  shelfId: string,
): Promise<string[]> {
  const rows = await database
    .select({ recipeId: schema.shelfRecipes.recipeId })
    .from(schema.shelfRecipes)
    .innerJoin(schema.shelves, eq(schema.shelves.id, schema.shelfRecipes.shelfId))
    .where(and(eq(schema.shelves.userId, userId), eq(schema.shelfRecipes.shelfId, shelfId)))
    .orderBy(desc(schema.shelfRecipes.addedAt));
  return rows.map((r) => r.recipeId);
}

/**
 * Status shelf per recipe, for rendering shelf badges on a list without a
 * round-trip per row.
 */
export async function statusByRecipe(
  database: Database,
  userId: string,
  recipeIds: string[],
): Promise<Map<string, StatusShelf>> {
  if (recipeIds.length === 0) return new Map();

  const rows = await database
    .select({ recipeId: schema.shelfRecipes.recipeId, type: schema.shelves.type })
    .from(schema.shelfRecipes)
    .innerJoin(schema.shelves, eq(schema.shelves.id, schema.shelfRecipes.shelfId))
    .where(
      and(
        eq(schema.shelves.userId, userId),
        ne(schema.shelves.type, "custom"),
        inArray(schema.shelfRecipes.recipeId, recipeIds),
      ),
    );

  return new Map(rows.map((r) => [r.recipeId, r.type as StatusShelf]));
}

/**
 * Put a recipe on a status shelf only if it isn't already on one.
 *
 * Used by the importer: a first import means "I want to cook this", but
 * re-importing the same link to refresh the card must not knock it back from
 * Cooked to Want to cook.
 */
export async function ensureInitialStatus(
  database: Database,
  userId: string,
  recipeId: string,
  status: StatusShelf,
): Promise<void> {
  const current = await getRecipeShelfState(database, userId, recipeId);
  if (current.status !== null) return;
  await setRecipeStatus(database, userId, recipeId, status);
}
