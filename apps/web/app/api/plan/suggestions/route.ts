import type { MealSlot } from "@seconds/core";
import { mealSlotOr, isISODate, todayISO } from "@seconds/core";
import { pendingSuggestions, suggestForFriend } from "@seconds/db";
import { readJson, withUser } from "@/lib/api";

export const runtime = "nodejs";

/** The pending pile of meals your friends have proposed for your own plan. */
export async function GET() {
  return withUser(async (userId, database) => ({
    suggestions: await pendingSuggestions(database, userId),
  }));
}

interface Body {
  ownerId: string;
  recipeId: string;
  date: string;
  slot: MealSlot;
}

/** Propose one of your own recipes for a friend's plan. */
export async function POST(request: Request) {
  const body = await readJson<Body>(request);
  const date = body.date && isISODate(body.date) ? body.date : todayISO();
  const slot = mealSlotOr(body.slot);

  return withUser(async (userId, database) => {
    await suggestForFriend(database, userId, body.ownerId ?? "", body.recipeId ?? "", date, slot);
    return { ok: true };
  });
}
