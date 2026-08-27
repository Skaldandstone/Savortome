import { NextResponse } from "next/server";
import { exchangeCode } from "@seconds/core";
import { db, saveConnection } from "@seconds/db";
import { errorResponse } from "@/lib/api";
import { KROGER_STATE_COOKIE, requireKrogerCredentials } from "@/lib/kroger";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/** Back from Kroger. Always ends up on the list, with a word about how it went. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = (status: string) =>
    NextResponse.redirect(new URL(`/list?kroger=${status}`, url.origin));

  // Kroger says no when the shopper declines, and there's nothing wrong with
  // that — it isn't an error worth a page of its own.
  if (url.searchParams.get("error")) return back("declined");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim().split("="))
    .find(([name]) => name === KROGER_STATE_COOKIE)?.[1];

  if (!code || !state || !expected || state !== expected) {
    return back("mismatch");
  }

  try {
    const database = db();
    const userId = await requireUserId(database);
    const token = await exchangeCode(requireKrogerCredentials(), code);
    await saveConnection(database, userId, "kroger", token);

    const response = back("connected");
    // The state is spent; leaving it around only widens the window for replay.
    response.cookies.delete(KROGER_STATE_COOKIE);
    return response;
  } catch (err) {
    return errorResponse(err);
  }
}
