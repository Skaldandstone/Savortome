import { deleteTemplate, renameTemplate } from "@seconds/db";
import { parseMealTemplateRename } from "@seconds/core";
import { BadRequestError, withUser } from "@/lib/api";
import { boundedJson } from "@/lib/bounded-json";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const response = await withUser(async (userId, database) => {
    const body = await boundedJson(request, 8192);
    let input;
    try { input = parseMealTemplateRename(body); }
    catch { throw new BadRequestError("Review the old name and a new name of one to 160 characters."); }
    return { confirmed: await renameTemplate(database, userId, id, input) };
  }, { redactUnexpectedErrors: true });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

/** Throw away a saved meal. The recipes inside it are untouched. */
export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const response = await withUser(async (userId, database) => ({ ok: await deleteTemplate(database, userId, id) }), { redactUnexpectedErrors: true });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
