import { createHash } from "node:crypto";
import { KitchenPageHeading } from '@/modules/woodland/KitchenPageHeading';
import { redirect } from "next/navigation";
import { emptyDraft } from "@seconds/core/format";
import { RecipeEditor } from "@/modules/editor";
import { Callout } from "@/ui";
import { clerkConfigured, currentUserId, databaseConfigured } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Write a recipe from nothing. The other half of importing one. */
export default async function NewRecipePage() {
  if (!databaseConfigured()) {
    return (
      <main className="woodland-workspace" data-kitchen-page="recipe/new">
      <KitchenPageHeading title="A new page in your journal" description="Write down a recipe in your own words." icon="book" />
        <Callout tone="warn" title="Nowhere to save it">
          Set DATABASE_URL in .env.local to write recipes.
        </Callout>
      </main>
    );
  }

  const userId = await currentUserId();
  if (clerkConfigured() && !userId) {
    redirect("/sign-in?redirect_url=/recipe/new");
  }
  const storageScope = createHash("sha256").update(userId ?? "local-development").digest("hex").slice(0, 16);

  return (
    <main className="woodland-workspace" data-kitchen-page="recipe/new">
      <KitchenPageHeading title="A new page in your journal" description="Write down a recipe in your own words." icon="book" />
      <RecipeEditor initial={emptyDraft()} storageScope={storageScope} />
    </main>
  );
}
