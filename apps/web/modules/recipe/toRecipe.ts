import type { Recipe } from "@nomnom/core/format";

/** The database row shape, expressed without importing the server-only db package. */
export interface RecipeRow {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  servings: number | null;
  servingsNote: string | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  totalMinutes: number | null;
  ingredients: Recipe["ingredients"];
  steps: Recipe["steps"];
  equipment: string[];
  tags: string[];
  cuisine: string | null;
  course: string | null;
  difficulty: string | null;
  confidence: number;
  extractionNotes: string[];
  sourceKind: Recipe["source"]["kind"];
  sourceUrl: string | null;
  sourceAuthor: string | null;
  sourceSiteName: string | null;
  extractionMethod: Recipe["source"]["extractionMethod"];
}

/** Rebuild the nested card shape from the flattened columns the table stores. */
export function toRecipe(row: RecipeRow): Recipe {
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
    difficulty: row.difficulty as Recipe["difficulty"],
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
}
