import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { clerkConfigured } from "./session";

/**
 * Send a signed-out visitor to sign in, keeping where they were headed.
 *
 * This exists because two different questions were being answered by one
 * check. `canUseBeta()` says *which experience to render*; it was also, by
 * accident, the only thing standing in front of several pages. When the beta
 * opened to the public that flag became true for everyone, and pages that had
 * never had an auth check of their own — the cooking workspace, the shopping
 * list, friends — started rendering their shell to anyone who typed the URL.
 *
 * No account data was reachable: every API route resolves the user itself and
 * answers 401, and every loader returns "sign in to see this". But an empty
 * kitchen rendered to a stranger is still wrong, and it reads as broken.
 *
 * So the gate is its own thing now, asked of Clerk directly rather than
 * through the database — the only question here is whether there is a session,
 * not who it belongs to.
 *
 * Genuinely public pages must not call this: the landing page, Discover,
 * shared recipe and template links, pricing, and the legal pages are all meant
 * to be readable by someone deciding whether to sign up at all.
 */
export async function requireSignedInPage(destination: string): Promise<void> {
  // Without Clerk keys the app runs on a single local development account, so
  // there is nobody to sign in as and nothing to protect.
  if (!clerkConfigured()) return;
  if ((await auth()).userId) return;
  redirect(`/sign-in?redirect_url=${encodeURIComponent(destination)}`);
}
