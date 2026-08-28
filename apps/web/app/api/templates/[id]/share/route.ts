import type { Visibility } from "@seconds/core";
import { setTemplateVisibility } from "@seconds/db";
import { readJson, withUser } from "@/lib/api";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Change who can see a saved meal. Only its owner can. */
export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await readJson<{ visibility: Visibility }>(request);

  return withUser(async (userId, database) => {
    const updated = await setTemplateVisibility(database, userId, id, body.visibility ?? "private");
    // Not found and not-yours are the same answer, same reasoning as a recipe's.
    return updated ?? { visibility: null };
  });
}
