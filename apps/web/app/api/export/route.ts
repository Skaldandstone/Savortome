import { buildArchive } from "@seconds/core";
import { allRecipesFor } from "@seconds/db";
import { toRecipe } from "@/modules/recipe";
import { withUserResponse } from "@/lib/api";

/**
 * The whole library, as a file.
 *
 * A collection you can't leave with isn't really yours, so this hands back
 * every recipe in full — method, provenance and all — in a stamped JSON
 * envelope that says what it is without needing this app to interpret it.
 */
export const runtime = "nodejs";

export async function GET() {
  return withUserResponse(async (userId, database) => {
    const rows = await allRecipesFor(database, userId);
    const archive = buildArchive(rows.map((row) => toRecipe(row)));

    // A JSON response the browser saves rather than renders. The date is in
    // the name because the second export shouldn't quietly overwrite the first.
    const stamp = archive.exportedAt.slice(0, 10);
    return new Response(JSON.stringify(archive, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="savortome-${stamp}.json"`,
        // An archive is a snapshot of the moment it was asked for.
        "cache-control": "no-store",
      },
    });
  });
}
