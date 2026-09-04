import { and, count, eq, ne } from "drizzle-orm";
import {
  canView,
  isStaple,
  type Recipe,
  type SharedRecipeView,
  type Visibility,
} from "@seconds/core";
import type { Database } from "../client.js";
import * as schema from "../schema.js";

/**
 * Sharing a recipe by link, and saving someone else's into your own library.
 *
 * Every read here goes through `canView` from `@seconds/core` rather than
 * hand-rolling the visibility check, so there is one place the rules live and
 * one place they're tested.
 */

/** Accepted friends, in both directions. */
export async function friendIdsOf(database: Database, userId: string): Promise<Set<string>> {
  const rows = await database
    .select({ friendId: schema.friendships.friendId })
    .from(schema.friendships)
    .where(
      and(eq(schema.friendships.userId, userId), eq(schema.friendships.status, "accepted")),
    );
  return new Set(rows.map((r) => r.friendId));
}

export interface SharedRecipe {
  recipe: Recipe;
  view: SharedRecipeView;
}

/**
 * Fetch a recipe for a viewer who may be anyone at all.
 *
 * Returns null both for "no such recipe" and "not allowed to see it" — telling
 * those apart would confirm a private recipe exists to whoever guessed its id.
 */
export async function getSharedRecipe(
  database: Database,
  recipeId: string,
  viewerId: string | null,
): Promise<SharedRecipe | null> {
  const row = await database.query.recipes.findFirst({
    where: eq(schema.recipes.id, recipeId),
  });
  if (!row) return null;

  const friendIds = viewerId ? await friendIdsOf(database, viewerId) : undefined;
  if (!canView({ ownerId: row.ownerId, visibility: row.visibility }, { viewerId, friendIds })) {
    return null;
  }

  const [owner, saves, ownCopy] = await Promise.all([
    database.query.users.findFirst({
      where: eq(schema.users.id, row.ownerId),
      columns: { handle: true, displayName: true, avatarUrl: true },
    }),
    database
      .select({ n: count() })
      .from(schema.recipes)
      .where(eq(schema.recipes.copiedFromId, recipeId)),
    viewerId
      ? database.query.recipes.findFirst({
          where: and(
            eq(schema.recipes.ownerId, viewerId),
            eq(schema.recipes.copiedFromId, recipeId),
          ),
          columns: { id: true },
        })
      : Promise.resolve(undefined),
  ]);

  return {
    recipe: {
      id: row.id,
      title: row.title,
      description: row.description,
      imageUrl: row.imageUrl,
      photos: row.photos,
      servings: row.servings,
      servingsNote: row.servingsNote,
      prepMinutes: row.prepMinutes,
      cookMinutes: row.cookMinutes,
      totalMinutes: row.totalMinutes,
      ingredients: row.ingredients,
      steps: row.steps,
      equipment: row.equipment,
      tags: row.tags,
      cuisine: row.cuisine,
      course: row.course,
      difficulty: row.difficulty as Recipe["difficulty"],
      confidence: row.confidence,
      extractionNotes: row.extractionNotes,
      ingredientNutritionGuesses: [],
      source: {
        kind: row.sourceKind,
        url: row.sourceUrl,
        author: row.sourceAuthor,
        siteName: row.sourceSiteName,
        extractionMethod: row.extractionMethod,
      },
      nutrition: row.nutrition,
    },
    view: {
      recipeId: row.id,
      sharedBy: {
        handle: owner?.handle ?? "someone",
        displayName: owner?.displayName ?? "Someone",
        avatarUrl: owner?.avatarUrl ?? null,
      },
      saveCount: saves[0]?.n ?? 0,
      alreadySaved: Boolean(ownCopy),
      canSave: Boolean(viewerId) && viewerId !== row.ownerId,
    },
  };
}

/** Change who can see a recipe. Only the owner can. */
export async function setRecipeVisibility(
  database: Database,
  userId: string,
  recipeId: string,
  visibility: Visibility,
): Promise<{ visibility: Visibility } | null> {
  const [updated] = await database
    .update(schema.recipes)
    .set({
      visibility,
      // Stamped the first time it leaves private, and left alone after, so it
      // records when this recipe first became shareable.
      ...(visibility !== "private" ? { sharedAt: new Date() } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(schema.recipes.id, recipeId), eq(schema.recipes.ownerId, userId)))
    .returning({ visibility: schema.recipes.visibility });

  return updated ?? null;
}

export class SaveRecipeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SaveRecipeError";
  }
}

/**
 * Copy someone else's shared recipe into your own library.
 *
 * The copy is yours to shelve, rate, and edit; the original owner sees only
 * that the save count went up. Attribution to the *original source* is carried
 * over untouched, because that credit belongs to whoever wrote the recipe, not
 * to whoever imported it.
 */
export async function saveSharedRecipe(
  database: Database,
  viewerId: string,
  recipeId: string,
): Promise<string> {
  const shared = await getSharedRecipe(database, recipeId, viewerId);
  if (!shared) throw new SaveRecipeError("That recipe isn't available.");

  const source = await database.query.recipes.findFirst({
    where: eq(schema.recipes.id, recipeId),
    columns: { ownerId: true },
  });
  if (source?.ownerId === viewerId) {
    throw new SaveRecipeError("That one's already yours.");
  }

  const existing = await database.query.recipes.findFirst({
    where: and(eq(schema.recipes.ownerId, viewerId), eq(schema.recipes.copiedFromId, recipeId)),
    columns: { id: true },
  });
  if (existing) return existing.id;

  const { recipe } = shared;
  const [created] = await database
    .insert(schema.recipes)
    .values({
      ownerId: viewerId,
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
      copiedFromId: recipeId,
      // A saved copy starts private. Sharing it on is the saver's choice.
      visibility: "private",
    })
    .returning({ id: schema.recipes.id });

  const newId = created!.id;

  // Rebuild the ingredient index so the copy is immediately findable by pantry
  // search — a saved recipe you can't find is barely saved.
  const byItem = new Map<string, boolean>();
  for (const ing of recipe.ingredients) {
    const key = ing.canonicalItem.trim();
    if (!key) continue;
    byItem.set(key, (byItem.get(key) ?? true) && ing.optional);
  }
  if (byItem.size > 0) {
    await database.insert(schema.recipeIngredients).values(
      [...byItem].map(([canonicalItem, optional]) => ({
        recipeId: newId,
        canonicalItem,
        optional,
        isStaple: isStaple(canonicalItem),
      })),
    );
  }

  return newId;
}

/** Recipes the user has shared, newest first. Their own "what have I put out there". */
export async function listSharedByUser(database: Database, userId: string) {
  return database.query.recipes.findMany({
    where: and(eq(schema.recipes.ownerId, userId), ne(schema.recipes.visibility, "private")),
    orderBy: (r, { desc }) => [desc(r.sharedAt)],
    columns: {
      id: true,
      title: true,
      imageUrl: true,
      visibility: true,
      sharedAt: true,
    },
  });
}
