import { and, eq, inArray } from "drizzle-orm";
import { parseReviewedTemplatePlan, type ReviewedTemplatePlanInput } from "@seconds/core";
import type { Database } from "../client.js";
import * as schema from "../schema.js";

/** One reviewed combination, all-or-nothing; no list, inventory or food log. */
export async function planReviewedTemplate(database: Database, ownerId: string, value: ReviewedTemplatePlanInput): Promise<ReviewedTemplatePlanInput | null> {
  const input = parseReviewedTemplatePlan(value);
  return database.transaction(async tx => {
    // UPDATE also blocks new item FK references during snapshot verification.
    const template = await tx.select({ id: schema.mealTemplates.id })
      .from(schema.mealTemplates)
      .where(and(eq(schema.mealTemplates.id, input.templateId), eq(schema.mealTemplates.ownerId, ownerId)))
      .for("update");
    if (template.length !== 1) return null;
    const items = await tx.select({ recipeId: schema.mealTemplateItems.recipeId })
      .from(schema.mealTemplateItems)
      .where(eq(schema.mealTemplateItems.templateId, input.templateId))
      .orderBy(schema.mealTemplateItems.role)
      .for("share");
    const actualIds = [...new Set(items.map(item => item.recipeId))].sort();
    if (actualIds.length !== input.recipeIds.length || actualIds.some((id, index) => id !== input.recipeIds[index])) return null;
    const owned = await tx.select({ id: schema.recipes.id }).from(schema.recipes)
      .where(and(eq(schema.recipes.ownerId, ownerId), inArray(schema.recipes.id, input.recipeIds)))
      .orderBy(schema.recipes.id).for("share");
    if (owned.length !== input.recipeIds.length) return null;

    // Existing recipe/date/slot primary keys make an identical retry a no-op.
    // Other meals remain; a combination is represented by its distinct dishes.
    await tx.insert(schema.mealPlanEntries)
      .values(input.recipeIds.map(recipeId => ({ userId: ownerId, recipeId, date: input.date, slot: input.slot })))
      .onConflictDoNothing();
    const confirmed = await tx.select({ recipeId: schema.mealPlanEntries.recipeId }).from(schema.mealPlanEntries)
      .where(and(eq(schema.mealPlanEntries.userId, ownerId), eq(schema.mealPlanEntries.date, input.date), eq(schema.mealPlanEntries.slot, input.slot), inArray(schema.mealPlanEntries.recipeId, input.recipeIds)))
      .orderBy(schema.mealPlanEntries.recipeId).for("share");
    if (confirmed.length !== input.recipeIds.length) throw new Error("Combination plan could not be confirmed.");
    return input;
  });
}
