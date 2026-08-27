import type { StatusShelf } from "@seconds/core";
import { getRecipeShelfState, setCustomShelfMembership, setRecipeStatus } from "@seconds/db";
import { readJson, withUser } from "@/lib/api";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  return withUser((userId, database) => getRecipeShelfState(database, userId, id));
}

/**
 * Two shapes, because the two kinds of shelf behave differently: a status is
 * exclusive and replaces whatever came before, a custom shelf just toggles.
 */
export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await readJson<{
    status: StatusShelf | null;
    shelfId: string;
    member: boolean;
  }>(request);

  return withUser((userId, database) => {
    if (body.shelfId !== undefined) {
      return setCustomShelfMembership(
        database,
        userId,
        id,
        body.shelfId,
        body.member !== false,
      );
    }
    return setRecipeStatus(database, userId, id, body.status ?? null);
  });
}
