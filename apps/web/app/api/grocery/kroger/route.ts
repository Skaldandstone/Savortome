import { findStores, krogerCredentials, type KrogerStatus } from "@seconds/core";
import { getConnection, removeConnection, setConnectionStore, type Database } from "@seconds/db";
import { readJson, withUser } from "@/lib/api";
import { catalogueToken, krogerApi } from "@/lib/kroger";

export const runtime = "nodejs";

/**
 * Everything the UI needs to decide what to offer.
 *
 * Every response from this route is this same shape, so a caller never has to
 * work out which fields survived which action — an action that answered with
 * only the part it changed once made the whole panel vanish after a disconnect.
 */
async function status(userId: string, database: Database): Promise<KrogerStatus> {
  const connection = await getConnection(database, userId, "kroger");
  return {
    configured: krogerCredentials(process.env) !== null,
    connected: connection !== null,
    store: connection?.locationId
      ? { locationId: connection.locationId, name: connection.locationName ?? "Kroger store" }
      : null,
  };
}

/** Whether this person has connected Kroger, and which store their cart is at. */
export async function GET() {
  return withUser(status);
}

interface Body {
  action: "stores" | "setStore" | "disconnect";
  zipCode: string;
  locationId: string;
  locationName: string;
}

/**
 * The three things left to do with a connection: find stores, pick one, or
 * throw the whole thing away.
 */
export async function POST(request: Request) {
  const body = await readJson<Body>(request);

  return withUser(async (userId, database) => {
    if (body.action === "disconnect") {
      await removeConnection(database, userId, "kroger");
      return status(userId, database);
    }

    if (body.action === "setStore") {
      await setConnectionStore(
        database,
        userId,
        "kroger",
        body.locationId ?? "",
        body.locationName ?? "Kroger store",
      );
      // Re-read rather than echo: nothing is written when the sign-in never
      // finished, and the caller should hear that rather than a store.
      return status(userId, database);
    }

    // Store lookup uses the application's own token, not the shopper's: it's a
    // read of a public catalogue and has nothing to do with their account.
    return {
      ...(await status(userId, database)),
      stores: await findStores(await catalogueToken(), body.zipCode ?? "", krogerApi()),
    };
  });
}
