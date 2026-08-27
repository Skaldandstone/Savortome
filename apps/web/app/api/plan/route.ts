import {
  isISODate,
  mealSlotOr,
  recipeIdsIn,
  todayISO,
  weekEnd,
  weekStart,
  type MealSlot,
} from "@seconds/core";
import {
  addRecipesToList,
  addToPlan,
  clearPlanRange,
  movePlanEntry,
  planForRange,
  removeFromPlan,
} from "@seconds/db";
import { readJson, withUser } from "@/lib/api";

export const runtime = "nodejs";

/** A week's plan. Defaults to the week you're standing in. */
export async function GET(request: Request) {
  const asked = new URL(request.url).searchParams.get("week");
  const start = weekStart(asked && isISODate(asked) ? asked : todayISO());

  return withUser(async (userId, database) => ({
    week: start,
    meals: await planForRange(database, userId, start, weekEnd(start)),
  }));
}

interface Body {
  action: "add" | "remove" | "move" | "clearWeek" | "toShoppingList";
  recipeId: string;
  date: string;
  slot: MealSlot;
  /** Where a move came from. */
  from: { date: string; slot: MealSlot };
  week: string;
}

/**
 * Everything you can do to a plan.
 *
 * One endpoint rather than five, because every action is a small write against
 * the same week and the response is always that week read back — the grid
 * redraws from one shape however it was changed.
 */
export async function POST(request: Request) {
  const body = await readJson<Body>(request);
  const start = weekStart(body.week && isISODate(body.week) ? body.week : todayISO());
  const date = body.date && isISODate(body.date) ? body.date : todayISO();
  const slot = mealSlotOr(body.slot);

  return withUser(async (userId, database) => {
    let addedToList = 0;

    // A write without a recipe is a malformed request, not a reason to throw:
    // the week reads back either way and the grid stays correct.
    const recipeId = body.recipeId ?? "";

    if (body.action === "add" && recipeId) {
      await addToPlan(database, userId, recipeId, date, slot);
    } else if (body.action === "remove" && recipeId) {
      await removeFromPlan(database, userId, recipeId, date, slot);
    } else if (body.action === "move" && body.from && recipeId) {
      await movePlanEntry(
        database,
        userId,
        recipeId,
        { date: body.from.date, slot: mealSlotOr(body.from.slot) },
        { date, slot },
      );
    } else if (body.action === "clearWeek") {
      await clearPlanRange(database, userId, start, weekEnd(start));
    } else if (body.action === "toShoppingList") {
      // The payoff: a week of meals becomes one merged, pantry-aware list.
      const meals = await planForRange(database, userId, start, weekEnd(start));
      const ids = recipeIdsIn(meals);
      if (ids.length > 0) {
        await addRecipesToList(database, userId, ids);
        addedToList = ids.length;
      }
    }

    return {
      week: start,
      meals: await planForRange(database, userId, start, weekEnd(start)),
      addedToList,
    };
  });
}
