import { foodLogDate } from "./food-log.js";
import { isMealSlot, type MealSlot } from "./plan.js";

export interface ReviewedMealInput { recipeId: string; date: string; slot: MealSlot; }

/** A reviewed calendar choice. Never silently choose a date or meal slot. */
export function parseReviewedMeal(value: unknown): ReviewedMealInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Review a recipe, date and meal slot.");
  const input = value as Record<string, unknown>;
  if (typeof input.recipeId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.recipeId)) throw new Error("Choose a saved recipe.");
  if (typeof input.slot !== "string" || !isMealSlot(input.slot)) throw new Error("Choose breakfast, lunch or dinner.");
  let date: string;
  try { date = foodLogDate(input.date); } catch { throw new Error("Choose a valid calendar date between 2000 and 2100."); }
  return { recipeId: input.recipeId, date, slot: input.slot };
}
