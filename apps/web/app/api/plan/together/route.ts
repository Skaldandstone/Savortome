import { suggestPlanTogether } from "@seconds/core";
import { getDietaryProfile, listPantry, searchByPantry } from "@seconds/db";
import { withUser } from "@/lib/api";

export const runtime = "nodejs";

/** Deterministic suggestions from the person's own pantry and recipe library. */
export async function GET() {
  return withUser(async (userId, database) => {
    const [pantry, profile] = await Promise.all([
      listPantry(database, userId),
      getDietaryProfile(database, userId),
    ]);
    const candidates = await searchByPantry(database, userId, {
      ingredients: pantry.map(entry => entry.canonicalItem),
      limit: 40,
    });
    return {
      ideas: suggestPlanTogether(candidates, pantry, profile),
      pantryCount: pantry.length,
    };
  });
}
