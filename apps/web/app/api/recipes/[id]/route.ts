import { NextResponse } from "next/server";
import type { RecipeDraft } from "@seconds/core";
import { deleteRecipe, getRecipe, updateRecipe } from "@seconds/db";
import { readJson, withUser } from "@/lib/api";

/**
 * A single recipe as JSON. The web app renders recipes server-side and doesn't
 * need this; the mobile app has no server render, so it does.
 */
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;

  const response = await withUser(async (userId, database) => {
    const row = await getRecipe(database, userId, id);
    if (!row) return null;

    return {
      id: row.id,
      title: row.title,
      description: row.description,
      imageUrl: row.imageUrl,
      photos: row.photos,
      servings: row.servings,
      servingsNote: row.servingsNote,
      prepMinutes: row.prepMinutes,
      cookMinutes: row.cookMinutes,
      totalMinutes: row.totalMinutes,
      ingredients: row.ingredients,
      steps: row.steps,
      equipment: row.equipment,
      tags: row.tags,
      cuisine: row.cuisine,
      course: row.course,
      difficulty: row.difficulty,
      confidence: row.confidence,
      extractionNotes: row.extractionNotes,
      visibility: row.visibility,
      verifiedAt: row.verifiedAt?.toISOString() ?? null,
      source: {
        kind: row.sourceKind,
        url: row.sourceUrl,
        author: row.sourceAuthor,
        siteName: row.sourceSiteName,
        extractionMethod: row.extractionMethod,
      },
      nutrition: row.nutrition,
    };
  });

  return notFoundIfNull(response);
}

/** Save corrections. Only the owner can, and a missing recipe answers the same. */
export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const draft = await readJson<RecipeDraft>(request);

  const response = await withUser(async (userId, database) =>
    (await updateRecipe(database, userId, id, draft as RecipeDraft)) ? { ok: true } : null,
  );
  return notFoundIfNull(response);
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;

  const response = await withUser(async (userId, database) =>
    (await deleteRecipe(database, userId, id)) ? { ok: true } : null,
  );
  return notFoundIfNull(response);
}

/**
 * `withUser` has no way to say "the user is fine but the recipe isn't there",
 * so a null payload means exactly that.
 */
async function notFoundIfNull(response: NextResponse): Promise<NextResponse> {
  if (response.ok && (await response.clone().json()) === null) {
    return NextResponse.json({ error: "No such recipe." }, { status: 404 });
  }
  return response;
}
