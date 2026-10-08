import {
  isISODate,
  parsePlanAction,
  type PlanAction,
  recipeIdsIn,
  todayISO,
  weekEnd,
  weekStart,
} from "@seconds/core";
import {
  addRecipesToList,
  addToPlan,
  clearPlanRange,
  movePlanEntry,
  planForRange,
  removeFromPlan,
} from "@seconds/db";
import { BadRequestError, withUser } from "@/lib/api";
import { boundedJson } from "@/lib/bounded-json";

export const runtime = "nodejs";
const privateResponse = (response: Response) => { response.headers.set("Cache-Control", "private, no-store"); return response; };

/** A week's plan. Defaults to the week you're standing in. */
export async function GET(request: Request) {
  return privateResponse(await withUser(async (userId, database) => {
    const params = new URL(request.url).searchParams;
    const asked = params.get("week");
    if (params.getAll("week").length > 1 || (asked !== null && !isISODate(asked))) throw new BadRequestError("Choose one valid calendar date for the requested week.");
    const start = weekStart(asked ?? todayISO());
    return { week: start, meals: await planForRange(database, userId, start, weekEnd(start)) };
  }, { redactUnexpectedErrors: true }));
}

/**
 * Everything you can do to a plan.
 *
 * One endpoint rather than five, because every action is a small write against
 * the same week and the response is always that week read back — the grid
 * redraws from one shape however it was changed.
 */
export async function POST(request: Request) {
  return privateResponse(await withUser(async (userId, database) => {
    const input = await boundedJson(request, 8192);
    let body: PlanAction;
    try { body = parsePlanAction(input); }
    catch { throw new BadRequestError("Review the action, recipe, valid calendar dates and explicit meal slots. Week-wide changes require a chosen week."); }
    const start = body.week;

    let addedToList = 0;

    if (body.action === "add") {
      if (!await addToPlan(database, userId, body.recipeId, body.date, body.slot)) throw new BadRequestError("That recipe is not available in your library. Nothing was added.");
    } else if (body.action === "remove") {
      await removeFromPlan(database, userId, body.recipeId, body.date, body.slot);
    } else if (body.action === "move") {
      const moved = await movePlanEntry(
        database,
        userId,
        body.recipeId,
        body.from,
        { date: body.date, slot: body.slot },
      );
      if (!moved) throw new BadRequestError("That meal could not be found at the chosen location. Reload your plan before moving it.");
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
  }, { redactUnexpectedErrors: true }));
}
