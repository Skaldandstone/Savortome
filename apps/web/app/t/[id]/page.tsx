import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db, getSharedTemplate } from "@seconds/db";
import { TemplateItems, SaveTemplateButton } from "@/modules/templates";
import { databaseConfigured, viewerId } from "@/lib/session";

/**
 * A shared meal, readable by whoever holds the link — same reach as a shared
 * recipe (`/r/[id]`), just for a whole main-plus-pairings bundle at once.
 */
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function load(id: string) {
  if (!databaseConfigured()) return null;
  const database = db();
  return getSharedTemplate(database, id, await viewerId(database));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const shared = await load(id);
  if (!shared) return { title: "Meal not found · Savortome" };

  return {
    title: `${shared.name} · Savortome`,
    description: `A meal shared by ${shared.sharedBy.displayName}.`,
  };
}

export default async function SharedTemplatePage({ params }: Params) {
  const { id } = await params;
  const shared = await load(id);

  // Missing and not-allowed look identical, exactly as a shared recipe does.
  if (!shared) notFound();

  return (
    <main>
      <p>Shared by {shared.sharedBy.displayName}</p>
      <h1>{shared.name}</h1>
      {shared.items.length === 0 ? (
        <p>Nothing in this meal is available to see right now.</p>
      ) : (
        <TemplateItems items={shared.items} linkBase="/r" />
      )}
      <SaveTemplateButton view={shared} />
    </main>
  );
}
