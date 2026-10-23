import { foodLogDate } from "./food-log.js";
import { parseReviewedMeal, type ReviewedMealInput } from "./reviewed-meal.js";
import { weekStart } from "./plan.js";

export type PlanAction =
  | ({ action: "add" | "remove"; week: string } & ReviewedMealInput)
  | ({ action: "move"; week: string; from: Pick<ReviewedMealInput, "date" | "slot"> } & ReviewedMealInput)
  | { action: "clearWeek" | "toShoppingList"; week: string };

/** Invalid write input never becomes an implicit today/dinner operation. */
export function parsePlanAction(value: unknown): PlanAction {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Review a meal-plan action.");
  const body = value as Record<string, unknown>;
  if (body.action === "clearWeek" || body.action === "toShoppingList") {
    return { action: body.action, week: weekStart(foodLogDate(body.week)) };
  }
  if (body.action !== "add" && body.action !== "remove" && body.action !== "move") throw new Error("Choose a known meal-plan action.");
  const meal = parseReviewedMeal(body);
  const week = weekStart(body.week === undefined ? meal.date : foodLogDate(body.week));
  if (body.action !== "move") return { ...meal, week, action: body.action };
  if (!body.from || typeof body.from !== "object" || Array.isArray(body.from)) throw new Error("Choose the meal's original date and slot.");
  const original = body.from as Record<string, unknown>;
  const from = parseReviewedMeal({ recipeId: meal.recipeId, date: original.date, slot: original.slot });
  return { ...meal, week, action: "move", from: { date: from.date, slot: from.slot } };
}
