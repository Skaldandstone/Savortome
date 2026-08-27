import { draftFromRecipe, type RecipeDraft } from "@seconds/core/format";
import type { RecipeRow } from "@/modules/recipe";

/**
 * A stored row as the form wants it. `difficulty` is the only real conversion:
 * the column is free text, the form is a fixed choice, and anything else in
 * there is better dropped than shown as a broken select.
 */
export function toDraft(row: RecipeRow): RecipeDraft {
  const difficulty = (["easy", "medium", "hard"] as const).find((d) => d === row.difficulty);
  return draftFromRecipe({ ...row, difficulty: difficulty ?? null });
}
