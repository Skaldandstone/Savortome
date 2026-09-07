import { KitchenPageHeading } from '@/modules/woodland/KitchenPageHeading';
import { redirect } from "next/navigation";
import { DietaryProfileForm } from "@/modules/profile";
import { Callout } from "@/ui";
import { clerkConfigured, currentUserId, databaseConfigured } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Preferences and allergies — steers suggestions, checked before a recipe reaches you or a friend. */
export default async function ProfilePage() {
  if (!databaseConfigured()) {
    return (
      <main className="woodland-workspace" data-kitchen-page="profile">
      <KitchenPageHeading title="Your dietary choices" description="Keep your preferences close when choosing what to cook." icon="sprig" />
        <Callout tone="warn" title="Nowhere to keep a profile">
          Set DATABASE_URL in .env.local to save preferences.
        </Callout>
      </main>
    );
  }

  if (clerkConfigured() && !(await currentUserId())) {
    redirect("/sign-in?redirect_url=/profile");
  }

  return (
    <main className="woodland-workspace" data-kitchen-page="profile">
      <KitchenPageHeading title="Your dietary choices" description="Keep your preferences close when choosing what to cook." icon="sprig" />
      <DietaryProfileForm />
    </main>
  );
}
