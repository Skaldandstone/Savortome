import { redirect } from "next/navigation";
import { TemplateList } from "@/modules/templates";
import { Callout } from "@/ui";
import { clerkConfigured, currentUserId, databaseConfigured } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Every meal you've saved from a recipe's "pairs well with" section. */
export default async function TemplatesPage() {
  if (!databaseConfigured()) {
    return (
      <main>
        <Callout tone="warn" title="Nowhere to keep a saved meal">
          Set DATABASE_URL in .env.local to save meals.
        </Callout>
      </main>
    );
  }

  if (clerkConfigured() && !(await currentUserId())) {
    redirect("/sign-in?redirect_url=/templates");
  }

  return (
    <main>
      <TemplateList />
    </main>
  );
}
