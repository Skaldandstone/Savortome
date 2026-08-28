import "server-only";
import { NextResponse } from "next/server";
import {
  InstacartError,
  KrogerError,
  RecipeValidationError,
  ShelfValidationError,
} from "@seconds/core";
import { FriendshipError } from "@seconds/core";
import { SaveRecipeError, SaveTemplateError, SuggestionError } from "@seconds/db";
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
    err instanceof SaveTemplateError ||
    err instanceof SuggestionError ||
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
  // Anything unrecognised is a bug, and a bug's message is for the log. Domain
  // errors above say something useful on purpose; this one can't, because it
  // doesn't know what it's holding — and a driver error would hand the caller
  // the failing query and its bound values.
  console.error("Unhandled API error:", err);
  return NextResponse.json(
    { error: "Something went wrong on our end." },
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

/**
 * The same guard, for a route whose answer isn't JSON.
 *
 * `withUser` serialises whatever the handler returns, which is right for an
 * API but wrong for a file download — those need their own content type and a
 * content-disposition header. Everything else is shared: same configuration
 * check, same auth, same error mapping.
 */
export async function withUserResponse(
  handler: (userId: string, database: Database) => Promise<Response>,
): Promise<Response> {
  if (!databaseConfigured()) {
    return NextResponse.json(
      { error: "Exporting needs a database. Set DATABASE_URL in .env.local." },
      { status: 501 },
    );
  }

  try {
    const database = db();
    return await handler(await requireUserId(database), database);
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
