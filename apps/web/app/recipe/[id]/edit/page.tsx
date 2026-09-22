import { createHash } from "node:crypto";
import { KitchenPageHeading } from '@/modules/woodland/KitchenPageHeading';
import { notFound, redirect } from "next/navigation";
import { RecipeEditor, toDraft } from "@/modules/editor";
import { loadRecipe } from "@/lib/library";
import { clerkConfigured, currentUserId, databaseConfigured } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Fix what the extractor got wrong — or anything you've since changed your mind about. */
export default async function EditRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const userId = databaseConfigured() ? await currentUserId() : null;
  if (clerkConfigured() && databaseConfigured() && !userId) {
    redirect(`/sign-in?redirect_url=/recipe/${id}/edit`);
  }

  // loadRecipe is already scoped to the signed-in user, so someone else's
  // recipe is indistinguishable from one that doesn't exist.
  const row = await loadRecipe(id);
  if (!row) notFound();
  const storageScope = createHash("sha256").update(userId ?? "local-development").digest("hex").slice(0, 16);

  return (
    <main className="woodland-workspace" data-kitchen-page="recipe/[id]/edit">
      <KitchenPageHeading title="A recipe, made yours" description="Keep the useful parts and adjust the rest." icon="book" />
      <RecipeEditor recipeId={row.id} initial={toDraft(row)} storageScope={storageScope} />
    </main>
  );
}
