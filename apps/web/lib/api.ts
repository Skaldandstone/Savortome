import "server-only";
import { NextResponse } from "next/server";
import {
  InstacartError,
  KrogerError,
  RecipeValidationError,
  ShelfValidationError,
} from "@seconds/core";
import { FriendshipError } from "@seconds/core";
import { SaveRecipeError } from "@seconds/db";
import { db, type Database } from "@seconds/db";
import {
  NotConfiguredError,
  NotSignedInError,
  databaseConfigured,
  requireUserId,
} from "./session";

/**
 * One place that turns a thrown domain error into the right status code, so
 * every route handler can be about its own job and nothing else.
 */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof NotSignedInError) {
    return NextResponse.json({ error: err.message }, { status: 401 });
  }
  if (
    err instanceof ShelfValidationError ||
    err instanceof SaveRecipeError ||
    err instanceof FriendshipError ||
    err instanceof RecipeValidationError
  ) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
  if (err instanceof NotConfiguredError) {
    return NextResponse.json({ error: err.message }, { status: 501 });
  }
  if (err instanceof KrogerError) {
    // 401 means "connect your account", which is a thing the shopper can act
    // on; anything else without a status is a configuration problem.
    return NextResponse.json({ error: err.message }, { status: err.status ?? 501 });
  }
  if (err instanceof InstacartError) {
    // A missing key is a configuration problem, not a server fault; a rejected
    // list is upstream's answer, so pass its status through.
    return NextResponse.json({ error: err.message }, { status: err.status ?? 501 });
  }
  return NextResponse.json(
    { error: err instanceof Error ? err.message : "Something went wrong." },
    { status: 500 },
  );
}

/**
 * Run a handler as the signed-in user. Refuses early — with a message worth
 * reading — when there is no database to talk to.
 */
export async function withUser<T>(
  handler: (userId: string, database: Database) => Promise<T>,
): Promise<NextResponse> {
  if (!databaseConfigured()) {
    return NextResponse.json(
      { error: "Shelves need a database. Set DATABASE_URL in .env.local." },
      { status: 501 },
    );
  }

  try {
    const database = db();
    return NextResponse.json(await handler(await requireUserId(database), database));
  } catch (err) {
    return errorResponse(err);
  }
}

/** Parse a JSON body, treating an unreadable one as an empty object. */
export async function readJson<T extends object>(request: Request): Promise<Partial<T>> {
  try {
    return (await request.json()) as Partial<T>;
  } catch {
    return {};
  }
}
