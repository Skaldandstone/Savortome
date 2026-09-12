import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import Stripe from "stripe";
import { db, deleteUserById, findUserForDeletion, upsertUserFromClerk } from "@seconds/db";
import { deleteRecipePhotos } from "@/lib/r2";
import { stripe, stripeConfigured } from "@/lib/stripe";

/**
 * Keeps the local `users` table in step with Clerk.
 *
 * Sign-in already upserts the user, so this exists for the changes that happen
 * without one: a profile edited in Clerk's UI, an account deleted, an email
 * changed. Deletion in particular has to arrive this way — the user will never
 * make another request for us to notice it on.
 *
 * Requires CLERK_WEBHOOK_SIGNING_SECRET. The route is public in middleware
 * because Clerk calls it unauthenticated; the signature is the authentication.
 */
export const runtime = "nodejs";

interface ClerkUserEvent {
  id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  image_url: string | null;
  primary_email_address_id: string | null;
  email_addresses: {
    id: string;
    email_address: string;
    verification: { status: string } | null;
  }[];
}

export async function POST(request: NextRequest) {
  if (!process.env.CLERK_WEBHOOK_SIGNING_SECRET) {
    return NextResponse.json({ error: "Webhook signing secret is not configured." }, { status: 501 });
  }

  let event: Awaited<ReturnType<typeof verifyWebhook>>;
  try {
    event = await verifyWebhook(request);
  } catch {
    // Never say why — a precise error is a hint for someone forging requests.
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  const database = db();

  try {
    switch (event.type) {
      case "user.created":
      case "user.updated": {
        const data = event.data as unknown as ClerkUserEvent;
        const primary =
          data.email_addresses.find((e) => e.id === data.primary_email_address_id) ??
          data.email_addresses[0];
        const email = primary?.email_address ?? `${data.id}@users.secondbreakfast.local`;
        const name = [data.first_name, data.last_name].filter(Boolean).join(" ");

        await upsertUserFromClerk(database, {
          clerkId: data.id,
          email,
          // Gates adopting an existing account that already holds this
          // address; see upsertUserFromClerk.
          emailVerified: primary?.verification?.status === "verified",
          displayName: name || data.username || email.split("@")[0] || "Cook",
          avatarUrl: data.image_url,
        });
        break;
      }

      case "user.deleted": {
        const { id } = event.data as { id?: string };
        const user = id ? await findUserForDeletion(database, id) : null;
        if (user) {
          // Cancel billing *before* the row (and the subscription id with
          // it) disappears — deleting the account must never be the thing
          // that leaves someone's subscription running with no account left
          // to cancel it from. Done first, and left to throw: a real Stripe
          // failure here should 500 the whole webhook so Clerk retries,
          // rather than deleting the account and quietly losing the one
          // piece of information needed to stop the charges.
          if (stripeConfigured() && user.stripeSubscriptionId) {
            await cancelSubscription(user.stripeSubscriptionId);
          }

          // Recipes, shelves, and ratings all cascade from the user row —
          // but that cascade is Postgres-only, so the account's R2 photo
          // objects need cleaning up here rather than relying on it.
          const { photos } = await deleteUserById(database, user.id);
          await deleteRecipePhotos(photos);
        }
        break;
      }

      default:
        // Everything else is subscribed to by someone else, or not at all.
        break;
    }
  } catch (err) {
    // 5xx tells Clerk to retry; a bad write here should not be silently dropped.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Webhook handling failed." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}

/**
 * Cancels a subscription, treating "there's nothing left to cancel" as
 * success rather than an error to retry over. Checks the subscription's own
 * status rather than pattern-matching Stripe's error text for "already
 * canceled" — a already-gone-on-Stripe's-side subscription (a prior partial
 * run of this same webhook, an account whose subscription lapsed some other
 * way) shouldn't block the account deletion waiting on this. Anything else
 * is a real failure and is left to throw, so the caller's 500 tells Clerk to
 * retry.
 */
async function cancelSubscription(subscriptionId: string): Promise<void> {
  const client = stripe();
  let subscription: Stripe.Subscription;
  try {
    subscription = await client.subscriptions.retrieve(subscriptionId);
  } catch (err) {
    if (err instanceof Stripe.errors.StripeInvalidRequestError && err.code === "resource_missing") return;
    throw err;
  }
  if (subscription.status === "canceled") return;
  await client.subscriptions.cancel(subscriptionId);
}
