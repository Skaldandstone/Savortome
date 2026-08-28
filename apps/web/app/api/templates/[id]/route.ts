import { deleteTemplate } from "@seconds/db";
import { withUser } from "@/lib/api";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Throw away a saved meal. The recipes inside it are untouched. */
export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  return withUser(async (userId, database) => ({ ok: await deleteTemplate(database, userId, id) }));
}
