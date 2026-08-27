import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import type { MealSlot, PlannedMeal } from "@seconds/core";
import type { Database } from "../client.js";
import * as schema from "../schema.js";

/**
 * What someone plans to cook, and when.
 *
 * Every read is scoped by owner, and every write joins against the recipes the
 * person actually owns — planning is a private act, and there is no path here
 * that lets one account put something on another's calendar.
 */

/** A week's meals, joined to enough of each recipe to draw the grid. */
export async function planForRange(
  database: Database,
  userId: string,
  from: string,
  to: string,
): Promise<PlannedMeal[]> {
  const rows = await database
    .select({
      recipeId: schema.mealPlanEntries.recipeId,
      date: schema.mealPlanEntries.date,
      slot: schema.mealPlanEntries.slot,
      title: schema.recipes.title,
      imageUrl: schema.recipes.imageUrl,
      totalMinutes: schema.recipes.totalMinutes,
    })
    .from(schema.mealPlanEntries)
    .innerJoin(schema.recipes, eq(schema.recipes.id, schema.mealPlanEntries.recipeId))
    .where(
      and(
        eq(schema.mealPlanEntries.userId, userId),
        gte(schema.mealPlanEntries.date, from),
        lte(schema.mealPlanEntries.date, to),
      ),
    )
    .orderBy(asc(schema.mealPlanEntries.date), asc(schema.mealPlanEntries.createdAt));

  return rows.map((row) => ({
    recipeId: row.recipeId,
    date: row.date,
    slot: row.slot as MealSlot,
    title: row.title,
    imageUrl: row.imageUrl,
    totalMinutes: row.totalMinutes,
  }));
}

/**
 * Put a recipe on a day.
 *
 * Returns false for a recipe that isn't yours rather than throwing: from the
 * outside, someone else's recipe and a recipe that doesn't exist are the same
 * thing, and saying which would confirm the id.
 *
 * Planning the same recipe twice in one slot is a double-tap, so it's a no-op
 * rather than an error.
 */
export async function addToPlan(
  database: Database,
  userId: string,
  recipeId: string,
  date: string,
  slot: MealSlot,
): Promise<boolean> {
  const owned = await database.query.recipes.findFirst({
    where: and(eq(schema.recipes.id, recipeId), eq(schema.recipes.ownerId, userId)),
    columns: { id: true },
  });
  if (!owned) return false;

  await database
    .insert(schema.mealPlanEntries)
    .values({ userId, recipeId, date, slot })
    .onConflictDoNothing();

  return true;
}

export async function removeFromPlan(
  database: Database,
  userId: string,
  recipeId: string,
  date: string,
  slot: MealSlot,
): Promise<void> {
  await database
    .delete(schema.mealPlanEntries)
    .where(
      and(
        eq(schema.mealPlanEntries.userId, userId),
        eq(schema.mealPlanEntries.recipeId, recipeId),
        eq(schema.mealPlanEntries.date, date),
        eq(schema.mealPlanEntries.slot, slot),
      ),
    );
}

/** Move a meal to another day or slot, keeping it a single row. */
export async function movePlanEntry(
  database: Database,
  userId: string,
  recipeId: string,
  from: { date: string; slot: MealSlot },
  to: { date: string; slot: MealSlot },
): Promise<void> {
  // Insert-then-delete rather than an update: the destination may already hold
  // this recipe, and an update would collide with the primary key.
  await database.batch([
    database
      .insert(schema.mealPlanEntries)
      .values({ userId, recipeId, date: to.date, slot: to.slot })
      .onConflictDoNothing(),
    database
      .delete(schema.mealPlanEntries)
      .where(
        and(
          eq(schema.mealPlanEntries.userId, userId),
          eq(schema.mealPlanEntries.recipeId, recipeId),
          eq(schema.mealPlanEntries.date, from.date),
          eq(schema.mealPlanEntries.slot, from.slot),
        ),
      ),
  ]);
}

/** Empty a run of days — how "clear this week" is done. */
export async function clearPlanRange(
  database: Database,
  userId: string,
  from: string,
  to: string,
): Promise<void> {
  await database
    .delete(schema.mealPlanEntries)
    .where(
      and(
        eq(schema.mealPlanEntries.userId, userId),
        gte(schema.mealPlanEntries.date, from),
        lte(schema.mealPlanEntries.date, to),
      ),
    );
}

/**
 * Which days a set of recipes already appears on.
 *
 * Lets a recipe card say "planned for Thursday" instead of offering to plan
 * something that's already planned.
 */
export async function plannedDatesFor(
  database: Database,
  userId: string,
  recipeIds: string[],
): Promise<Map<string, string[]>> {
  if (recipeIds.length === 0) return new Map();

  const rows = await database
    .select({
      recipeId: schema.mealPlanEntries.recipeId,
      date: schema.mealPlanEntries.date,
    })
    .from(schema.mealPlanEntries)
    .where(
      and(
        eq(schema.mealPlanEntries.userId, userId),
        inArray(schema.mealPlanEntries.recipeId, recipeIds),
      ),
    )
    .orderBy(asc(schema.mealPlanEntries.date));

  const byRecipe = new Map<string, string[]>();
  for (const row of rows) {
    byRecipe.set(row.recipeId, [...(byRecipe.get(row.recipeId) ?? []), row.date]);
  }
  return byRecipe;
}
