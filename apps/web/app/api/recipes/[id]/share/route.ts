import type { Visibility } from "@nomnom/core";
import { setRecipeVisibility } from "@nomnom/db";
import { readJson, withUser } from "@/lib/api";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Change who can see a recipe. Only its owner can. */
export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await readJson<{ visibility: Visibility }>(request);

  return withUser(async (userId, database) => {
    const updated = await setRecipeVisibility(
      database,
      userId,
      id,
      body.visibility ?? "private",
    );
    // Not found and not-yours are the same answer, so neither confirms the
    // recipe exists to someone who guessed the id.
    if (!updated) return { visibility: null };
    return updated;
  });
}
