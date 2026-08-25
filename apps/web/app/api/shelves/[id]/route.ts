import type { Visibility } from "@nomnom/core";
import { deleteShelf, renameShelf, setShelfVisibility } from "@nomnom/db";
import { readJson, withUser } from "@/lib/api";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await readJson<{ name: string; visibility: Visibility }>(request);

  return withUser(async (userId, database) => {
    if (body.name !== undefined) await renameShelf(database, userId, id, body.name);
    if (body.visibility !== undefined) {
      await setShelfVisibility(database, userId, id, body.visibility);
    }
    return { ok: true };
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  return withUser(async (userId, database) => {
    await deleteShelf(database, userId, id);
    return { ok: true };
  });
}
