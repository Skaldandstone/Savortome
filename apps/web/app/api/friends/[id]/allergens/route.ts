import { NextResponse } from "next/server";
import { friendAllergens } from "@seconds/db";
import { withUser } from "@/lib/api";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * A friend's allergies, so a suggestion can warn before it's sent. Only their
 * allergies, only for an actual friend — `friendAllergens` refuses anyone else,
 * answering null rather than confirming or denying who the id belongs to.
 */
export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;

  const response = await withUser(async (userId, database) => {
    const allergens = await friendAllergens(database, userId, id);
    return allergens === null ? null : { allergens };
  });

  // `withUser` always answers 200 with whatever the handler returned; null is
  // the sentinel this route uses for "not a friend," same as elsewhere.
  if (response.ok && (await response.clone().json()) === null) {
    return NextResponse.json({ error: "Not a friend." }, { status: 404 });
  }
  return response;
}
