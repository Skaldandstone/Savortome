import { suggestPlanTogether } from "@seconds/core";
import { getDietaryProfile, listPantry, searchByPantry } from "@seconds/db";
import { withUser } from "@/lib/api";

export const runtime = "nodejs";

/** Deterministic suggestions from the person's own pantry and recipe library. */
export async function GET(request: Request) {
  return withUser(async (userId, database) => {
    const [pantry, profile] = await Promise.all([
      listPantry(database, userId),
      getDietaryProfile(database, userId),
    ]);
    const candidates = await searchByPantry(database, userId, {
      ingredients: pantry.map(entry => entry.canonicalItem),
      limit: 40,
    });
    const strictDietary = new URL(request.url).searchParams.get("strictDietary") === "true";
    const eligible = strictDietary ? candidates.filter(candidate => profile.dietaryTags.every(tag => candidate.tags.includes(tag))) : candidates;
    return {
      ideas: suggestPlanTogether(eligible, pantry, profile),
      pantryCount: pantry.length,
    };
  });
}
