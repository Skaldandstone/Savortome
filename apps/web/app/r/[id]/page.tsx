import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db, getSharedRecipe } from "@nomnom/db";
import { RecipeCard } from "@/modules/recipe";
import { SaveSharedButton, SharedByLine } from "@/modules/sharing";
import { databaseConfigured, viewerId } from "@/lib/session";

/**
 * A shared recipe, readable by whoever holds the link.
 *
 * This is the one page in the app that a stranger — or a crawler — can reach,
 * so it takes the viewer as "whoever you happen to be" and lets
 * `getSharedRecipe` decide what that entitles them to. It renders the recipe
 * card and nothing about the owner's own relationship with it: no shelves, no
 * private rating, no notes.
 */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function load(id: string) {
  if (!databaseConfigured()) return null;
  const database = db();
  return getSharedRecipe(database, id, await viewerId(database));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const shared = await load(id);
  if (!shared) return { title: "Recipe not found · NomNom" };

  const { recipe, view } = shared;
  return {
    title: `${recipe.title} · NomNom`,
    description: recipe.description ?? `A recipe shared by ${view.sharedBy.displayName}.`,
    openGraph: {
      title: recipe.title,
      description: recipe.description ?? undefined,
      images: recipe.imageUrl ? [recipe.imageUrl] : undefined,
      type: "article",
    },
  };
}

export default async function SharedRecipePage({ params }: Params) {
  const { id } = await params;
  const shared = await load(id);

  // Missing and not-allowed deliberately look identical, so a 404 never
  // confirms that a private recipe exists to someone guessing ids.
  if (!shared) notFound();

  return (
    <main>
      <SharedByLine view={shared.view} />
      <RecipeCard recipe={shared.recipe} />
      <SaveSharedButton view={shared.view} />
    </main>
  );
}
