import "server-only";
import type { LibrarySort, ShelfSummary } from "@seconds/core";
import {
  db,
  getRecipe,
  countRecipes,
  listRecipes,
  listShelves,
  recipeIdsOnShelf,
  searchRecipes,
  statusByRecipe,
} from "@seconds/db";
import type { LibraryEntry } from "@/modules/library";
import type { RecipeRow } from "@/modules/recipe";
import { NotSignedInError, currentUserId, databaseConfigured } from "./session";

/**
 * The read side of the app. Keeps every database concern out of the route
 * components, which only ever deal in view shapes.
 */

export type LibraryResult =
  | { kind: "ok"; entries: LibraryEntry[]; shelves: ShelfSummary[]; total: number }
  | { kind: "unavailable"; reason: string };

const NO_DATABASE =
  "Set DATABASE_URL in .env.local to keep the recipes you import. Without it the importer still works — cards just aren't saved.";

const SIGNED_OUT = "Sign in to see the recipes you've saved.";

export async function loadLibrary(
  shelfId?: string,
  query = "",
  sort?: LibrarySort,
  limit = 30,
): Promise<LibraryResult> {
  if (!databaseConfigured()) return { kind: "unavailable", reason: NO_DATABASE };

  try {
    const database = db();
    const userId = await currentUserId(database);
    if (!userId) return { kind: "unavailable", reason: SIGNED_OUT };

    const shelves = await listShelves(database, userId);

    // A shelf filter and a search each narrow to a set of ids; together they
    // intersect, so "the Korean thing on my baking shelf" works.
    const shelfIds = shelfId ? await recipeIdsOnShelf(database, userId, shelfId) : null;
    const matchIds = query.trim() ? await searchRecipes(database, userId, query) : null;

    const ids =
      matchIds && shelfIds
        ? matchIds.filter((id) => shelfIds.includes(id))
        : (matchIds ?? shelfIds ?? undefined);

    const rows = await listRecipes(database, userId, { limit, ids, sort });

    // The list is filtered and paged; the export isn't. A count taken here is
    // the only honest number to put next to "download everything".
    const total = await countRecipes(database, userId);

    // One query for every badge, rather than one per row.
    const statuses = await statusByRecipe(
      database,
      userId,
      rows.map((r) => r.id),
    );

    return {
      kind: "ok",
      shelves,
      total,
      entries: rows.map((row) => ({
        id: row.id,
        title: row.title,
        imageUrl: row.imageUrl,
        totalMinutes: row.totalMinutes,
        ingredientCount: row.ingredients.length,
        attribution: row.sourceAuthor ?? row.sourceSiteName ?? row.sourceKind,
        status: statuses.get(row.id) ?? null,
        stars: row.stars,
        timesCooked: row.timesCooked ?? 0,
      })),
    };
  } catch (err) {
    if (err instanceof NotSignedInError) return { kind: "unavailable", reason: SIGNED_OUT };
    return {
      kind: "unavailable",
      reason: `Couldn't read the library: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }
}

export async function loadRecipe(id: string): Promise<RecipeRow | null> {
  if (!databaseConfigured()) return null;
  const database = db();
  const userId = await currentUserId(database);
  if (!userId) return null;
  const row = await getRecipe(database, userId, id);
  return row ?? null;
}
