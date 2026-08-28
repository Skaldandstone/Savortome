import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db, type Database } from "@seconds/db";
import { errorResponse } from "./api";
import { databaseConfigured } from "./session";

/**
 * Staff-only guard for the /api/admin/* routes consumed by the Skald & Stone
 * Adminhelper portal. Not user-facing: callers present the shared
 * X-Admin-Token header, which the portal's Worker holds as a secret. When
 * ADMIN_API_TOKEN is unset the whole surface refuses with 401, so a
 * deployment without the secret exposes nothing.
 */
function tokenMatches(provided: string | null): boolean {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function withAdmin<T>(
  request: Request,
  handler: (database: Database) => Promise<T>,
): Promise<NextResponse> {
  if (!tokenMatches(request.headers.get("x-admin-token"))) {
    return NextResponse.json({ error: "Admin token required" }, { status: 401 });
  }
  if (!databaseConfigured()) {
    return NextResponse.json(
      { error: "Admin routes need a database. Set DATABASE_URL." },
      { status: 501 },
    );
  }
  try {
    const result = await handler(db());
    if (result === undefined) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
