import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { krogerAuthorizeUrl } from "@nomnom/core";
import { errorResponse } from "@/lib/api";
import { KROGER_STATE_COOKIE, requireKrogerCredentials } from "@/lib/kroger";
import { requireUserId } from "@/lib/session";
import { db } from "@nomnom/db";

export const runtime = "nodejs";

/**
 * Send the shopper to Kroger to sign in.
 *
 * A GET that redirects rather than an API call, because the browser has to
 * follow it — and it's the browser's own cookie that carries the `state` we
 * check on the way back, so nobody can hand someone a callback URL that
 * silently attaches a stranger's Kroger account to their session.
 */
export async function GET() {
  try {
    const database = db();
    await requireUserId(database);

    const state = randomUUID();
    const response = NextResponse.redirect(krogerAuthorizeUrl(requireKrogerCredentials(), state));

    response.cookies.set(KROGER_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    });

    return response;
  } catch (err) {
    return errorResponse(err);
  }
}
