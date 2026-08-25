import { and, avg, count, eq, gt, inArray } from "drizzle-orm";
import { assertValidStars, type RecipeRating } from "@nomnom/core";
import type { Database } from "../client.js";
import * as schema from "../schema.js";

export interface CommunityRating {
  average: number;
  count: number;
}

/** Set or update this user's star rating and review for a recipe. */
export async function rateRecipe(
  database: Database,
  userId: string,
  recipeId: string,
  stars: number,
  review: string | null,
): Promise<RecipeRating> {
  assertValidStars(stars);
  const now = new Date();

  const [row] = await database
    .insert(schema.ratings)
    .values({ userId, recipeId, stars, review })
    .onConflictDoUpdate({
      target: [schema.ratings.userId, schema.ratings.recipeId],
      // timesCooked is owned by the shelf flow, so it is deliberately untouched here.
      set: { stars, review, updatedAt: now },
    })
    .returning();

  return {
    stars: row!.stars,
    review: row!.review,
    timesCooked: row!.timesCooked,
    lastCookedAt: row!.lastCookedAt?.toISOString() ?? null,
  };
}

export async function clearRating(
  database: Database,
  userId: string,
  recipeId: string,
): Promise<void> {
  await database
    .delete(schema.ratings)
    .where(and(eq(schema.ratings.userId, userId), eq(schema.ratings.recipeId, recipeId)));
}

/**
 * Average stars across everyone who rated a recipe. Unrated cooks (stars 0)
 * are excluded so "I made it" doesn't drag the average to zero.
 */
export async function communityRatings(
  database: Database,
  recipeIds: string[],
): Promise<Map<string, CommunityRating>> {
  if (recipeIds.length === 0) return new Map();

  const rows = await database
    .select({
      recipeId: schema.ratings.recipeId,
      average: avg(schema.ratings.stars),
      total: count(schema.ratings.stars),
    })
    .from(schema.ratings)
    .where(and(inArray(schema.ratings.recipeId, recipeIds), gt(schema.ratings.stars, 0)))
    .groupBy(schema.ratings.recipeId);

  return new Map(
    rows.map((r) => [r.recipeId, { average: Number(r.average ?? 0), count: r.total }]),
  );
}
