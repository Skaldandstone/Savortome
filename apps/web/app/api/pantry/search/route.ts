import { interpretPantryQuery, type PantryQuery } from "@seconds/core";
import { listPantry, searchByPantry } from "@seconds/db";
import { readJson, withUser } from "@/lib/api";

// Interpreting a query can call the model, so this needs the Node runtime.
export const runtime = "nodejs";
export const maxDuration = 60;

interface SearchBody {
  /** Free text: a list of ingredients, or a request with conditions in it. */
  query?: string;
  /** Search against the saved pantry instead of typed text. */
  usePantry?: boolean;
}

export async function POST(request: Request) {
  const body = await readJson<SearchBody>(request);
  const text = body.query?.trim() ?? "";

  return withUser(async (userId, database) => {
    let query: PantryQuery;
    let interpreted = false;
    let note: string | undefined;

    if (text) {
      ({ query, interpreted, note } = await interpretPantryQuery(text));
    } else {
      query = {
        ingredients: [],
        excludeIngredients: [],
        tags: [],
        maxMinutes: null,
        course: null,
      };
    }

    // An empty ingredient list means "use what I've told you I have" — the
    // saved pantry — rather than "I have nothing".
    let ingredients = query.ingredients;
    let usedPantry = false;
    if (ingredients.length === 0 && (body.usePantry !== false || !text)) {
      ingredients = (await listPantry(database, userId)).map((p) => p.canonicalItem);
      usedPantry = ingredients.length > 0;
    }

    const results = await searchByPantry(database, userId, { ...query, ingredients });

    return { query: { ...query, ingredients }, results, interpreted, usedPantry, note };
  });
}
