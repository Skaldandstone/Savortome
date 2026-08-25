import { NextResponse } from "next/server";
import { getRecipe } from "@nomnom/db";
import { withUser } from "@/lib/api";

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
      source: {
        kind: row.sourceKind,
        url: row.sourceUrl,
        author: row.sourceAuthor,
        siteName: row.sourceSiteName,
        extractionMethod: row.extractionMethod,
      },
    };
  });

  // withUser can't express "found the user but not the recipe", so unwrap here.
  if (response.ok && (await response.clone().json()) === null) {
    return NextResponse.json({ error: "No such recipe." }, { status: 404 });
  }
  return response;
}
