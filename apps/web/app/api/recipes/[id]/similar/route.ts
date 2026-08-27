import { NextResponse } from "next/server";
import { db, similarRecipes } from "@seconds/db";
import { errorResponse } from "@/lib/api";
import { databaseConfigured, viewerId } from "@/lib/session";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** "More like this", by shared ingredients. Readable signed out. */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  if (!databaseConfigured()) return NextResponse.json([]);

  try {
    const database = db();
    return NextResponse.json(await similarRecipes(database, id, await viewerId(database)));
  } catch (err) {
    return errorResponse(err);
  }
}
