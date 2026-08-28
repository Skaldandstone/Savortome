import { ALLERGENS, DIETARY_TAGS, type DietaryProfile } from "@seconds/core";
import { getDietaryProfile, setDietaryProfile } from "@seconds/db";
import { readJson, withUser } from "@/lib/api";

export const runtime = "nodejs";

/** Your own dietary preferences and allergies. */
export async function GET() {
  return withUser((userId, database) => getDietaryProfile(database, userId));
}

export async function PUT(request: Request) {
  const body = await readJson<DietaryProfile>(request);

  return withUser(async (userId, database) => {
    // Only known values are stored — a fixed taxonomy is the whole point of
    // matching against it later, and an unrecognised string would just be
    // silently unmatchable dead weight on the row.
    const profile = {
      dietaryTags: (body.dietaryTags ?? []).filter((t) => (DIETARY_TAGS as readonly string[]).includes(t)),
      allergens: (body.allergens ?? []).filter((a) => (ALLERGENS as readonly string[]).includes(a)),
    };
    await setDietaryProfile(database, userId, profile);
    return profile;
  });
}
