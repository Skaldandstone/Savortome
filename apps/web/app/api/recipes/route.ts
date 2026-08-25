import { listRecipes, listShelves, recipeIdsOnShelf, statusByRecipe } from "@nomnom/db";
import { withUser } from "@/lib/api";

/**
 * The signed-in user's library. The web app reads this server-side; mobile has
 * no server render, so it needs the endpoint.
 */
export const runtime = "nodejs";

export async function GET(request: Request) {
  const shelfId = new URL(request.url).searchParams.get("shelf") ?? undefined;

  return withUser(async (userId, database) => {
    const shelves = await listShelves(database, userId);
    const ids = shelfId ? await recipeIdsOnShelf(database, userId, shelfId) : undefined;
    const rows = await listRecipes(database, userId, { ids, limit: 60 });

    const statuses = await statusByRecipe(
      database,
      userId,
      rows.map((r) => r.id),
    );

    return {
      shelves,
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
