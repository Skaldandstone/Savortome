import { NextResponse } from "next/server";
import {
  availableProviders,
  buildHandoff,
  createInstacartList,
  sendListToKroger,
  type CartProviderId,
} from "@seconds/core";
import { currentShoppingList, getShoppingList, recordCartHandoff } from "@seconds/db";
import { errorResponse, readJson, withUser } from "@/lib/api";
import { catalogueToken, krogerApi, liveConnection } from "@/lib/kroger";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Which services can be used right now, given what's configured. */
export async function GET() {
  return NextResponse.json(availableProviders(process.env));
}

/**
 * Hand the list to a grocery service.
 *
 * Instacart and Kroger build real carts, by very different routes — Instacart
 * takes names and matches them itself, Kroger takes UPCs resolved against one
 * specific store. Everything else opens the shop and copies the list, because
 * no public cart API exists for them. See `carts.ts`.
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
        ? await createInstacartList(lines, { title: list?.name ?? "Second Breakfast shopping list" })
        : provider === "kroger"
          ? await sendListToKroger(lines, await liveConnection(database, userId), {
              ...krogerApi(),
              productAccessToken: await catalogueToken(),
            })
          : buildHandoff(provider, lines);

    await recordCartHandoff(database, listId, handoff);
    return handoff;
  }).catch(errorResponse);
}
