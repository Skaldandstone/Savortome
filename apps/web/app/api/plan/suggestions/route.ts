import { parseReviewedMeal } from "@seconds/core";
import { pendingSuggestions, suggestForFriend } from "@seconds/db";
import { BadRequestError, withUser } from "@/lib/api";
import { boundedJson } from "@/lib/bounded-json";

export const runtime = "nodejs";

/** The pending pile of meals your friends have proposed for your own plan. */
export async function GET() {
  const response = await withUser(async (userId, database) => ({
    suggestions: await pendingSuggestions(database, userId),
  }), { redactUnexpectedErrors: true });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

/** Propose one of your own recipes for a friend's plan. */
export async function POST(request: Request) {
  const response = await withUser(async (userId, database) => {
    const body = await boundedJson(request, 2048);
    let meal;
    try { meal = parseReviewedMeal(body); }
    catch { throw new BadRequestError("Choose a saved recipe, valid date and meal slot before suggesting it."); }
    if (typeof body.ownerId !== "string" || !body.ownerId.trim() || body.ownerId.length > 200) throw new BadRequestError("Choose a friend for this suggestion.");
    await suggestForFriend(database, userId, body.ownerId, meal.recipeId, meal.date, meal.slot);
    return { ok: true };
  }, { redactUnexpectedErrors: true });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
