import { NextResponse } from "next/server";
import {
  availableProviders,
  buildHandoff,
  createInstacartList,
  type CartProviderId,
} from "@nomnom/core";
import { currentShoppingList, getShoppingList, recordCartHandoff } from "@nomnom/db";
import { errorResponse, readJson, withUser } from "@/lib/api";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Which services can be used right now, given what's configured. */
export async function GET() {
  return NextResponse.json(availableProviders(process.env));
}

/**
 * Hand the list to a grocery service.
 *
 * Instacart builds a real cart. Everything else opens the store and copies the
 * list, because no public cart API exists for them — see `carts.ts`.
 */
export async function POST(request: Request) {
  const body = await readJson<{ provider: CartProviderId }>(request);
  const provider = body.provider ?? "clipboard";

  return withUser(async (userId, database) => {
    const listId = await currentShoppingList(database, userId);
    const list = await getShoppingList(database, userId, listId);
    const lines = list?.items ?? [];

    const handoff =
      provider === "instacart"
        ? await createInstacartList(lines, { title: list?.name ?? "NomNom shopping list" })
        : buildHandoff(provider, lines);

    await recordCartHandoff(database, listId, handoff);
    return handoff;
  }).catch(errorResponse);
}
