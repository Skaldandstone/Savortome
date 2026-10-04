import { parsePlanTogetherInput, parsePlanTogetherOptions, suggestPlanTogether } from "@seconds/core";
import { getDietaryProfile, listPantry, searchByPantry } from "@seconds/db";
import { BadRequestError, withUser } from "@/lib/api";
import { boundedJson } from "@/lib/bounded-json";

export const runtime = "nodejs";

/** Deterministic suggestions from the person's own pantry and recipe library. */
export async function GET(request: Request) {
  return planningResponse(request, false);
}

/** Same read-only search, with optional food choices in a bounded body. */
export async function POST(request: Request) {
  return planningResponse(request, true);
}

async function planningResponse(request: Request, json: boolean) {
  const response = await withUser(async (userId, database) => {
    const input = json ? await boundedJson(request, 2048) : null;
    let options;
    try { options = json ? parsePlanTogetherInput(input) : parsePlanTogetherOptions(new URL(request.url).searchParams); }
    catch { throw new BadRequestError("Choose supported meal limits and one ingredient name per field (up to 100 characters)."); }
    const [pantry, profile] = await Promise.all([
      listPantry(database, userId),
      getDietaryProfile(database, userId),
    ]);
    if (options.pantryItem && !pantry.some(entry => entry.canonicalItem === options.pantryItem)) throw new BadRequestError("That item is no longer in your saved pantry. Reload the pantry choices or enter a temporary ingredient.");
    const candidates = await searchByPantry(database, userId, {
      ingredients: pantry.map(entry => entry.canonicalItem),
      maxMinutes: options.maxMinutes,
      requireIngredients: options.pantryItem ? [options.pantryItem] : options.useIngredient ? [options.useIngredient] : [],
      excludeIngredients: options.skipIngredient ? [options.skipIngredient] : [],
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
