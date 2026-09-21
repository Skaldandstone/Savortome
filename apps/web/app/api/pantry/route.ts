import { parsePantryEntryUpdate, parsePantryInput } from "@seconds/core";
import { addPantryItems, clearPantry, listPantry, removePantryItems, updatePantryItem } from "@seconds/db";
import { readJson, withUser } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  return withUser((userId, database) => listPantry(database, userId));
}

/**
 * Accepts either free text ("2 chicken thighs, rice") or already-canonical
 * items, so the same endpoint serves the type-it-in box and a tap-to-add chip.
 */
export async function POST(request: Request) {
  const body = await readJson<{ text: string; items: string[] }>(request);

  return withUser((userId, database) => {
    const entries = body.text
      ? parsePantryInput(body.text)
      : parsePantryInput((body.items ?? []).join(", "));
    return addPantryItems(database, userId, entries);
  });
}

export async function DELETE(request: Request) {
  const body = await readJson<{ items: string[]; all: boolean }>(request);

  return withUser(async (userId, database) => {
    if (body.all) {
      await clearPantry(database, userId);
      return [];
    }
    return removePantryItems(database, userId, body.items ?? []);
  });
}

export async function PATCH(request: Request) {
  const body = await readJson<Record<string, unknown>>(request);
  return withUser((userId, database) => updatePantryItem(database, userId, parsePantryEntryUpdate(body)));
}
