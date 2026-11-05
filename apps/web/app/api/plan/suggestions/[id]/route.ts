import { acceptSuggestion, dismissSuggestion } from "@seconds/db";
import { BadRequestError, withUser } from "@/lib/api";
import { boundedJson } from "@/lib/bounded-json";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Accept or dismiss a friend's suggestion for your own plan. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const response = await withUser(async (userId, database) => {
    const body = await boundedJson(request, 1024);
    if (body.action !== "accept" && body.action !== "dismiss") throw new BadRequestError("Choose accept or dismiss for this meal suggestion.");
    const ok =
      body.action === "accept"
        ? await acceptSuggestion(database, userId, id)
        : await dismissSuggestion(database, userId, id);
    return { ok };
  }, { redactUnexpectedErrors: true });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
