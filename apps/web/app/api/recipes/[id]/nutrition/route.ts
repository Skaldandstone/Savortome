import { NextResponse } from "next/server";
import { computeNutrition, guessIngredientNutrition } from "@seconds/core";
import { getRecipe, setRecipeNutrition } from "@seconds/db";
import { withUser } from "@/lib/api";

/**
 * Fill in nutrition for a recipe that doesn't have one — a hand-typed recipe,
 * or an import from a page with no published nutrition of its own.
 *
 * Everywhere else in the app, this rides along free with an import's own
 * model call. There is no import happening here, so this is the one nutrition
 * action that pays for a small model call on purpose — kept cheap (a short
 * prompt, a small schema, low effort) since USDA still gets first crack at
 * every ingredient; the model only ever fills the gaps it leaves.
 *
 * Currently free to use, not metered as a credit — see the plan doc's open
 * question on this. Small enough to gate later without touching anything else.
 */
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const { id } = await params;

  const response = await withUser(async (userId, database) => {
    const recipe = await getRecipe(database, userId, id);
    if (!recipe) return null;

    // Already has one — editing clears it (see updateRecipe's draftColumns),
    // so a present value here means nothing has changed since it was computed.
    // Re-fetching costs nothing and saves whoever double-clicks a second call.
    if (recipe.nutrition) return { nutrition: recipe.nutrition };

    const guesses = await guessIngredientNutrition(recipe.ingredients);
    const nutrition = await computeNutrition(recipe.ingredients, guesses, recipe.servings);

    const saved = await setRecipeNutrition(database, userId, id, nutrition);
    return saved ? { nutrition } : null;
  });

  // `withUser` always answers 200 with whatever the handler returned; `null`
  // is the sentinel this route uses for "no such recipe," same as its sibling.
  if (response.ok && (await response.clone().json()) === null) {
    return NextResponse.json({ error: "No such recipe." }, { status: 404 });
  }
  return response;
}
