import { notFound, redirect } from "next/navigation";
import { canUseBeta } from '@/lib/beta';
import { RecipeCard, toRecipe } from "@/modules/recipe";
import { ShareControl } from "@/modules/sharing";
import { loadRecipe } from "@/lib/library";
import { clerkConfigured, currentUserId, databaseConfigured } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Signed out is a different problem from "no such recipe", and saying so is
  // the difference between a dead end and a way forward.
  if (clerkConfigured() && databaseConfigured() && !(await currentUserId())) {
    redirect(`/sign-in?redirect_url=/recipe/${id}`);
  }

  const row = await loadRecipe(id);
  if (!row) notFound();

  return (
    <main className="woodland-workspace" data-kitchen-page="recipe">
      <RecipeCard
        headingLevel={await canUseBeta() ? 1 : 2}
        recipe={toRecipe(row)}
        shelvedId={row.id}
        verifiedAt={row.verifiedAt?.toISOString() ?? null}
      />
      <ShareControl recipeId={row.id} initialVisibility={row.visibility} />
    </main>
  );
}
