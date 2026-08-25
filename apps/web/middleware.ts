import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Attaches Clerk's session to the request. Nothing more.
 *
 * Authorization deliberately does *not* live here. Clerk deprecated
 * `createRouteMatcher` for exactly the reason it names: matching paths in
 * middleware can drift from how Next actually routes a request, which leaves
 * protected data reachable. So every page and route checks for itself, at the
 * point it reads the data — see `lib/session.ts`.
 *
 * `clerkMiddleware()` throws without a publishable key, so it is only
 * constructed when one exists; without keys the app runs on the local
 * development account and this passes requests straight through.
 */
const clerkConfigured = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
);

const withClerk = clerkConfigured ? clerkMiddleware() : null;

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  return withClerk ? withClerk(request, event) : NextResponse.next();
}

export const config = {
  matcher: [
    // Everything except Next internals and static files.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
