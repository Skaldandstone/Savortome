import { and, eq, inArray, sql } from "drizzle-orm";
import { STARTER_RECIPES, STARTER_RECIPE_AUTHOR, isStaple } from "@seconds/core";
import type { Database as RootDatabase } from "../client.js";
import * as schema from "../schema.js";

type Database = Omit<RootDatabase, "$client">;

/**
 * Ensure Discover always has Savortome-authored recipes for a new account.
 * Fixed UUIDs make this safe to run after every catalogue release; the cheap
 * complete-set read avoids writes on ordinary requests.
 */
export async function ensureStarterRecipes(database: Database): Promise<void> {
  const ids = STARTER_RECIPES.map((recipe) => recipe.id);
  if (await catalogueComplete(database, ids)) return;

  await database.transaction(async (tx) => {
    // Two cold requests can arrive together. Serialize only this tiny seed
    // transaction, then recheck so the second request becomes a no-op.
    await tx.execute(sql`select pg_advisory_xact_lock(1396790852)`);
    if (await catalogueComplete(tx, ids)) return;

    await tx
      .insert(schema.users)
      .values({
        id: STARTER_RECIPE_AUTHOR.id,
        clerkId: STARTER_RECIPE_AUTHOR.catalogueId,
        email: STARTER_RECIPE_AUTHOR.email,
        handle: STARTER_RECIPE_AUTHOR.handle,
        displayName: STARTER_RECIPE_AUTHOR.displayName,
      })
      .onConflictDoUpdate({
        target: schema.users.id,
        set: {
          email: STARTER_RECIPE_AUTHOR.email,
          clerkId: STARTER_RECIPE_AUTHOR.catalogueId,
          handle: STARTER_RECIPE_AUTHOR.handle,
          displayName: STARTER_RECIPE_AUTHOR.displayName,
        },
      });

    for (const recipe of STARTER_RECIPES) {
      const draft = recipe.draft;
      await tx
        .insert(schema.recipes)
        .values({
          id: recipe.id,
          ownerId: STARTER_RECIPE_AUTHOR.id,
          title: draft.title,
          description: draft.description,
          imageUrl: draft.imageUrl,
          servings: draft.servings,
          servingsNote: draft.servingsNote,
          prepMinutes: draft.prepMinutes,
          cookMinutes: draft.cookMinutes,
          totalMinutes: draft.totalMinutes,
          ingredients: draft.ingredients,
          steps: draft.steps,
          equipment: draft.equipment,
          tags: draft.tags,
          cuisine: draft.cuisine,
          course: draft.course,
          difficulty: draft.difficulty,
          skillDemands: recipe.skillDemands,
          sourceKind: "manual",
          sourceAuthor: STARTER_RECIPE_AUTHOR.displayName,
          sourceSiteName: "Savortome",
          extractionMethod: "manual",
          confidence: 1,
          extractionNotes: [],
          verifiedAt: new Date(),
          visibility: "public",
          sharedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.recipes.id,
          set: {
            title: draft.title,
            description: draft.description,
            servings: draft.servings,
            servingsNote: draft.servingsNote,
            prepMinutes: draft.prepMinutes,
            cookMinutes: draft.cookMinutes,
            totalMinutes: draft.totalMinutes,
            ingredients: draft.ingredients,
            steps: draft.steps,
            equipment: draft.equipment,
            tags: draft.tags,
            cuisine: draft.cuisine,
            course: draft.course,
            difficulty: draft.difficulty,
            skillDemands: recipe.skillDemands,
            sourceAuthor: STARTER_RECIPE_AUTHOR.displayName,
            sourceSiteName: "Savortome",
            verifiedAt: new Date(),
            visibility: "public",
            sharedAt: new Date(),
            updatedAt: new Date(),
          },
        });

      await tx.delete(schema.recipeIngredients).where(eq(schema.recipeIngredients.recipeId, recipe.id));
      const indexed = new Map<string, boolean>();
      for (const ingredient of draft.ingredients) {
        const key = ingredient.canonicalItem.trim();
        if (!key) continue;
        indexed.set(key, (indexed.get(key) ?? true) && ingredient.optional);
      }
      await tx.insert(schema.recipeIngredients).values(
        [...indexed].map(([canonicalItem, optional]) => ({
          recipeId: recipe.id,
          canonicalItem,
          optional,
          isStaple: isStaple(canonicalItem),
        })),
      );
    }
  });
}

async function catalogueComplete(database: Database, ids: string[]): Promise<boolean> {
  const [author, present] = await Promise.all([
    database
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(
        eq(schema.users.id, STARTER_RECIPE_AUTHOR.id),
        eq(schema.users.clerkId, STARTER_RECIPE_AUTHOR.catalogueId),
      )),
    database
      .select({ id: schema.recipes.id })
      .from(schema.recipes)
      .where(inArray(schema.recipes.id, ids)),
  ]);
  return author.length === 1 && present.length === ids.length;
}
