import { VISIBILITIES, type Visibility } from "@seconds/core";
import { setTemplateVisibility } from "@seconds/db";
import { BadRequestError, withUser } from "@/lib/api";
import { boundedJson } from "@/lib/bounded-json";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Change who can see a saved meal. Only its owner can. */
export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const response = await withUser(async (userId, database) => {
    const body = await boundedJson(request, 512) as { visibility?: unknown };
    if (!body || Array.isArray(body) || typeof body.visibility !== "string" || !VISIBILITIES.includes(body.visibility as Visibility)) throw new BadRequestError("Choose a known saved-meal visibility setting.");
    const updated = await setTemplateVisibility(database, userId, id, body.visibility as Visibility);
    // Not found and not-yours are the same answer, same reasoning as a recipe's.
    return updated ?? { visibility: null };
  }, { redactUnexpectedErrors: true });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
