import { parseReviewedMeal, weekEnd, weekStart } from "@seconds/core";
import { addToPlan, planForRange } from "@seconds/db";
import { BadRequestError, withUser } from "@/lib/api";
import { boundedJson } from "@/lib/bounded-json";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const response = await withUser(async (userId, database) => {
    const body = await boundedJson(request, 1024);
    let meal;
    try { meal = parseReviewedMeal(body); }
    catch { throw new BadRequestError("Review a saved recipe, valid date and breakfast, lunch or dinner before adding it."); }
    // Owner-scoped existing operation; identical recipe/date/slot is a no-op.
    if (!await addToPlan(database, userId, meal.recipeId, meal.date, meal.slot)) throw new BadRequestError("That recipe is not available in your library. Nothing was added.");
    const week = weekStart(meal.date);
    const meals = await planForRange(database, userId, week, weekEnd(week));
    if (!meals.some(entry => entry.recipeId === meal.recipeId && entry.date === meal.date && entry.slot === meal.slot)) throw new BadRequestError("The meal could not be confirmed in your plan. Reload your plan before trying again.");
    return { week, meals };
  }, { redactUnexpectedErrors: true });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
