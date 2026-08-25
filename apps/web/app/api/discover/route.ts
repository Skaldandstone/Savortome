import { NextResponse } from "next/server";
import { db, discoverFeed, popularTags, searchDiscover } from "@nomnom/db";
import { errorResponse } from "@/lib/api";
import { databaseConfigured, viewerId } from "@/lib/session";

/**
 * Browsing and searching shared recipes.
 *
 * Readable signed out, like the shared-recipe page — discovery you have to
 * sign up for isn't discovery. `viewerId` is used only to leave your own
 * recipes out.
 */
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!databaseConfigured()) {
    return NextResponse.json({ recipes: [], tags: [] });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const tags = url.searchParams.getAll("tag").filter(Boolean);
  const maxMinutesRaw = url.searchParams.get("maxMinutes");
  const maxMinutes = maxMinutesRaw ? Number(maxMinutesRaw) : null;

  try {
    const database = db();
    const viewer = await viewerId(database);
    const filters = {
      query,
      tags,
      maxMinutes: Number.isFinite(maxMinutes) ? maxMinutes : null,
    };

    const [recipes, tagList] = await Promise.all([
      query
        ? searchDiscover(database, viewer, filters)
        : discoverFeed(database, viewer, filters),
      popularTags(database, viewer),
    ]);

    return NextResponse.json({ recipes, tags: tagList, query, appliedTags: tags });
  } catch (err) {
    return errorResponse(err);
  }
}
