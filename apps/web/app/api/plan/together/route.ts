import { parsePlanTogetherOptions, suggestPlanTogether } from "@seconds/core";
import { getDietaryProfile, listPantry, searchByPantry } from "@seconds/db";
import { BadRequestError, withUser } from "@/lib/api";

export const runtime = "nodejs";

/** Deterministic suggestions from the person's own pantry and recipe library. */
export async function GET(request: Request) {
  const response = await withUser(async (userId, database) => {
    let options;
    try { options = parsePlanTogetherOptions(new URL(request.url).searchParams); }
    catch { throw new BadRequestError("Choose a supported time limit and pantry matching setting."); }
    const [pantry, profile] = await Promise.all([
      listPantry(database, userId),
      getDietaryProfile(database, userId),
    ]);
    const candidates = await searchByPantry(database, userId, {
      ingredients: pantry.map(entry => entry.canonicalItem),
      maxMinutes: options.maxMinutes,
      limit: 40,
    });
    return {
      ideas: suggestPlanTogether(candidates, pantry, profile, new Date(), 3, options),
      pantryCount: pantry.length,
    };
  }, { redactUnexpectedErrors: true });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
