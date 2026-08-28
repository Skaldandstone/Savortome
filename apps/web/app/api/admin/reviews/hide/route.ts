import { setReviewHidden } from "@seconds/db";
import { BadRequestError, readJson } from "@/lib/api";
import { withAdmin } from "@/lib/admin";

/**
 * Staff action: hide or unhide a review's free text. Soft — the rating row
 * and its stars remain; only the text is suppressed and kept for audit.
 * A review is keyed by (userId, recipeId).
 */
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await readJson<{ userId: string; recipeId: string; hidden: boolean }>(request);
  return withAdmin(request, async (database) => {
    if (!body.userId || !body.recipeId) {
      throw new BadRequestError("userId and recipeId are required");
    }
    const row = await setReviewHidden(database, body.userId, body.recipeId, body.hidden !== false);
    return row ?? undefined;
  });
}
