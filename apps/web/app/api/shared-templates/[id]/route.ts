import { NextResponse } from "next/server";
import { db, getSharedTemplate } from "@seconds/db";
import { errorResponse } from "@/lib/api";
import { databaseConfigured, viewerId } from "@/lib/session";

/**
 * A shared meal as JSON. The web app renders `/t/[id]` server-side; mobile
 * has no server render, so it reads this instead. Same rules either way —
 * both go through `getSharedTemplate`.
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
    const shared = await getSharedTemplate(database, id, await viewerId(database));
    if (!shared) return NextResponse.json({ error: "That meal isn't available." }, { status: 404 });
    return NextResponse.json(shared);
  } catch (err) {
    return errorResponse(err);
  }
}
