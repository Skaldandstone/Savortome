import { acceptSuggestion, dismissSuggestion } from "@seconds/db";
import { readJson, withUser } from "@/lib/api";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Accept or dismiss a friend's suggestion for your own plan. */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await readJson<{ action: "accept" | "dismiss" }>(request);

  return withUser(async (userId, database) => {
    const ok =
      body.action === "accept"
        ? await acceptSuggestion(database, userId, id)
        : await dismissSuggestion(database, userId, id);
    return { ok };
  });
}
