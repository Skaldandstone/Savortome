import { currentShoppingList, getShoppingList, removeListItem, setItemChecked } from "@nomnom/db";
import { readJson, withUser } from "@/lib/api";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await readJson<{ checked: boolean }>(request);

  return withUser(async (userId, database) => {
    await setItemChecked(database, userId, id, body.checked !== false);
    return getShoppingList(database, userId, await currentShoppingList(database, userId));
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;

  return withUser(async (userId, database) => {
    await removeListItem(database, userId, id);
    return getShoppingList(database, userId, await currentShoppingList(database, userId));
  });
}
