import { redirect } from "next/navigation";
import { emptyDraft } from "@nomnom/core/format";
import { RecipeEditor } from "@/modules/editor";
import { Callout } from "@/ui";
import { clerkConfigured, currentUserId, databaseConfigured } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Write a recipe from nothing. The other half of importing one. */
export default async function NewRecipePage() {
  if (!databaseConfigured()) {
    return (
      <main>
        <Callout tone="warn" title="Nowhere to save it">
          Set DATABASE_URL in .env.local to write recipes.
        </Callout>
      </main>
    );
  }

  if (clerkConfigured() && !(await currentUserId())) {
    redirect("/sign-in?redirect_url=/recipe/new");
  }

  return (
    <main>
      <RecipeEditor initial={emptyDraft()} />
    </main>
  );
}
