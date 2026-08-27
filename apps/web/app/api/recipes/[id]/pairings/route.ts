import { NextResponse } from "next/server";
import { db, suggestedPairings } from "@seconds/db";
import { errorResponse } from "@/lib/api";
import { currentUserId, databaseConfigured } from "@/lib/session";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * "Pairs well with" — a side, a drink, and a dessert from the signed-in
 * user's own library. Unlike `/similar`, this reads private state, so it
 * takes the actual signed-in user rather than a public-or-not viewer, and
 * answers empty for anyone signed out.
 */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const empty = { side: [], drink: [], dessert: [] };
  if (!databaseConfigured()) return NextResponse.json(empty);

  try {
    const database = db();
    const userId = await currentUserId(database);
    if (!userId) return NextResponse.json(empty);
    return NextResponse.json(await suggestedPairings(database, userId, id));
  } catch (err) {
    return errorResponse(err);
  }
}
