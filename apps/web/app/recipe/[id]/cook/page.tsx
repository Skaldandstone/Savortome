import { notFound, redirect } from "next/navigation";
import { KitchenPageHeading } from '@/modules/woodland/KitchenPageHeading';
import { CookMode } from "@/modules/cook";
import { toRecipe } from "@/modules/recipe";
import { loadRecipe } from "@/lib/library";
import { clerkConfigured, currentUserId, databaseConfigured } from "@/lib/session";

export const dynamic = "force-dynamic";

/** The recipe, one step at a time, for someone actually standing at the stove. */
export default async function CookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (clerkConfigured() && databaseConfigured() && !(await currentUserId())) {
    redirect(`/sign-in?redirect_url=/recipe/${id}/cook`);
  }

  const row = await loadRecipe(id);
  if (!row) notFound();

  return (
    <main className="woodland-workspace" data-kitchen-page="recipe/cook">
      <KitchenPageHeading title={row.title} description="One step at a time." icon="pot" />
      <CookMode recipe={toRecipe(row)} recipeId={row.id} />
    </main>
  );
}
