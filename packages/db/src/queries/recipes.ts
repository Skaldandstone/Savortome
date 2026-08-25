import { and, eq, inArray, sql } from "drizzle-orm";
import { isStaple, type Recipe } from "@nomnom/core";
import type { Database } from "../client.js";
import * as schema from "../schema.js";

/**
 * Persist a freshly extracted recipe and rebuild its ingredient index.
 * Re-importing the same source URL updates the existing card rather than
 * creating a second copy — people paste the same link twice all the time.
 */
export async function saveRecipe(
  database: Database,
  ownerId: string,
  recipe: Recipe,
): Promise<string> {
  const row = {
    ownerId,
    title: recipe.title,
    description: recipe.description,
    imageUrl: recipe.imageUrl,
    servings: recipe.servings,
    servingsNote: recipe.servingsNote,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    totalMinutes: recipe.totalMinutes,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    equipment: recipe.equipment,
    tags: recipe.tags,
    cuisine: recipe.cuisine,
    course: recipe.course,
    difficulty: recipe.difficulty,
    sourceKind: recipe.source.kind,
    sourceUrl: recipe.source.url,
    sourceAuthor: recipe.source.author,
    sourceSiteName: recipe.source.siteName,
    extractionMethod: recipe.source.extractionMethod,
    confidence: recipe.confidence,
    extractionNotes: recipe.extractionNotes,
    updatedAt: new Date(),
  } satisfies Partial<typeof schema.recipes.$inferInsert> & { ownerId: string };

  const [saved] = await database
    .insert(schema.recipes)
    .values(row)
    .onConflictDoUpdate({
      target: [schema.recipes.ownerId, schema.recipes.sourceUrl],
      // The unique index is partial, so Postgres needs its predicate here to
      // infer it as the arbiter. `setWhere` filters the UPDATE instead, which
      // leaves the conflict target unmatched and errors at runtime.
      targetWhere: sql`${schema.recipes.sourceUrl} is not null`,
      set: row,
    })
    .returning({ id: schema.recipes.id });

  const recipeId = saved!.id;
  await reindexIngredients(database, recipeId, recipe);
  return recipeId;
}

/** Rebuild the flattened ingredient rows that pantry search will join against. */
async function reindexIngredients(
  database: Database,
  recipeId: string,
  recipe: Recipe,
): Promise<void> {
  // Two lines can share a canonical item ("garlic" whole and minced); the index
  // holds one row per item, so collapse before inserting.
  const byItem = new Map<string, { optional: boolean }>();
  for (const ing of recipe.ingredients) {
    const key = ing.canonicalItem.trim();
    if (!key) continue;
    const existing = byItem.get(key);
    byItem.set(key, { optional: (existing?.optional ?? true) && ing.optional });
  }

  const clear = database
    .delete(schema.recipeIngredients)
    .where(eq(schema.recipeIngredients.recipeId, recipeId));

  if (byItem.size === 0) {
    await clear;
    return;
  }

  await database.batch([
    clear,
    database.insert(schema.recipeIngredients).values(
      [...byItem].map(([canonicalItem, { optional }]) => ({
        recipeId,
        canonicalItem,
        optional,
        isStaple: isStaple(canonicalItem),
      })),
    ),
  ]);
}

export interface ListRecipesOptions {
  limit?: number;
  /** Restrict to these ids, in this order. Used when filtering by shelf. */
  ids?: string[];
}

/** The signed-in user's recipes, newest first. */
export async function listRecipes(
  database: Database,
  ownerId: string,
  options: ListRecipesOptions = {},
) {
  const { limit = 50, ids } = options;

  if (ids) {
    if (ids.length === 0) return [];
    const rows = await database.query.recipes.findMany({
      where: and(eq(schema.recipes.ownerId, ownerId), inArray(schema.recipes.id, ids)),
      limit,
    });
    // Preserve the caller's ordering (shelves order by when they were added).
    const rank = new Map(ids.map((id, i) => [id, i]));
    return rows.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  }

  return database.query.recipes.findMany({
    where: eq(schema.recipes.ownerId, ownerId),
    orderBy: (r, { desc }) => [desc(r.createdAt)],
    limit,
  });
}

export async function getRecipe(database: Database, ownerId: string, recipeId: string) {
  return database.query.recipes.findFirst({
    where: and(eq(schema.recipes.id, recipeId), eq(schema.recipes.ownerId, ownerId)),
  });
}
