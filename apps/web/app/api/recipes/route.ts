import type { RecipeDraft } from "@seconds/core";
import {
  createRecipe,
  listRecipes,
  listShelves,
  recipeIdsOnShelf,
  searchRecipes,
  statusByRecipe,
} from "@seconds/db";
import { readJson, withUser } from "@/lib/api";

/**
 * The signed-in user's library. The web app reads this server-side; mobile has
 * no server render, so it needs the endpoint.
 */
export const runtime = "nodejs";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const shelfId = params.get("shelf") ?? undefined;
  const query = params.get("q")?.trim() ?? "";

  return withUser(async (userId, database) => {
    const shelves = await listShelves(database, userId);

    // A shelf filter and a search both narrow to a set of ids; together they
    // intersect, so "the Korean thing on my baking shelf" works.
    const shelfIds = shelfId ? await recipeIdsOnShelf(database, userId, shelfId) : null;
    const matchIds = query ? await searchRecipes(database, userId, query) : null;

    const ids =
      matchIds && shelfIds
        ? matchIds.filter((id) => shelfIds.includes(id))
        : (matchIds ?? shelfIds ?? undefined);

    const rows = await listRecipes(database, userId, { ids, limit: 60 });

    const statuses = await statusByRecipe(
      database,
      userId,
      rows.map((r) => r.id),
    );

    return {
      shelves,
      query,
      recipes: rows.map((row) => ({
        id: row.id,
        title: row.title,
        imageUrl: row.imageUrl,
        totalMinutes: row.totalMinutes,
        ingredientCount: row.ingredients.length,
        attribution: row.sourceAuthor ?? row.sourceSiteName ?? row.sourceKind,
        status: statuses.get(row.id) ?? null,
        visibility: row.visibility,
      })),
    };
  });
}

/** Write a recipe by hand. */
export async function POST(request: Request) {
  const draft = await readJson<RecipeDraft>(request);

  return withUser(async (userId, database) => ({
    // The draft is validated inside the query, where the same rules also guard
    // the edit path — there is no way to write an invalid card from either.
    recipeId: await createRecipe(database, userId, draft as RecipeDraft),
  }));
}
