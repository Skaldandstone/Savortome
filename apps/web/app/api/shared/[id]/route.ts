import { NextResponse } from "next/server";
import { db, getSharedRecipe } from "@nomnom/db";
import { errorResponse } from "@/lib/api";
import { databaseConfigured, viewerId } from "@/lib/session";

/**
 * A shared recipe as JSON. The web app renders `/r/[id]` server-side; mobile
 * has no server render, so it reads this. Same visibility rules either way —
 * both go through `getSharedRecipe`.
 */
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  if (!databaseConfigured()) {
    return NextResponse.json({ error: "No database configured." }, { status: 501 });
  }

  try {
    const database = db();
    const shared = await getSharedRecipe(database, id, await viewerId(database));
    // Missing and not-allowed look identical, exactly as on the page.
    if (!shared) return NextResponse.json({ error: "That recipe isn't available." }, { status: 404 });
    return NextResponse.json(shared);
  } catch (err) {
    return errorResponse(err);
  }
}
