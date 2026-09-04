import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { db, deleteUserByClerkId, upsertUserFromClerk } from "@seconds/db";
import { deleteRecipePhoto } from "@/lib/r2";

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
  email_addresses: { id: string; email_address: string }[];
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
          displayName: name || data.username || email.split("@")[0] || "Cook",
          avatarUrl: data.image_url,
        });
        break;
      }

      case "user.deleted": {
        const { id } = event.data as { id?: string };
        // Recipes, shelves, and ratings all cascade from the user row — but
        // that cascade is Postgres-only, so the account's R2 photo objects
        // need cleaning up here rather than relying on the cascade for it.
        if (id) {
          const { photos } = await deleteUserByClerkId(database, id);
          await Promise.all(
            photos.map((photo) => deleteRecipePhoto(photo.key).catch(() => undefined)),
          );
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
