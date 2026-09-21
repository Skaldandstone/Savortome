import { flagsForRecipe, type DietaryProfile } from "./dietary.js";
import { pantryAttention } from "./pantry-guidance.js";
import type { PantryEntry, PantryMatch } from "./pantry.js";

export interface PlanTogetherCandidate extends PantryMatch {
  title: string;
  imageUrl: string | null;
  totalMinutes: number | null;
  tags: string[];
  ingredients: string[];
}

export interface PlanTogetherIdea {
  recipeId: string;
  title: string;
  imageUrl: string | null;
  totalMinutes: number | null;
  have: string[];
  missing: string[];
  canMakeNow: boolean;
  reason: string;
  resurfaceItems: string[];
}

/**
 * Pantry planning stays deterministic and local. Detected allergen conflicts
 * are removed before any ranking; dietary tags influence order only because a
 * missing recipe tag is not proof that a recipe violates a preference.
 */
export function suggestPlanTogether(
  candidates: readonly PlanTogetherCandidate[],
  pantry: readonly PantryEntry[],
  profile: DietaryProfile,
  now: Date = new Date(),
  limit = 3,
): PlanTogetherIdea[] {
  const pantryByName = new Map(pantry.map(entry => [entry.canonicalItem, entry]));
  const taggedPreferences = new Set<string>(profile.dietaryTags);

  return candidates
    .filter(candidate => flagsForRecipe(
      candidate.ingredients.map(canonicalItem => ({ canonicalItem, optional: false })),
      profile.allergens,
    ).length === 0)
    .map(candidate => {
      const resurfaceItems = candidate.have.filter(item => {
        const entry = pantryByName.get(item);
        return entry ? pantryAttention(entry, now)?.shouldResurface === true : false;
      });
      const preferenceMatches = candidate.tags.filter(tag => taggedPreferences.has(tag)).length;
      return { candidate, resurfaceItems, preferenceMatches };
    })
    .sort((a, b) =>
      Number(b.resurfaceItems.length > 0) - Number(a.resurfaceItems.length > 0) ||
      Number(b.candidate.canMakeNow) - Number(a.candidate.canMakeNow) ||
      a.candidate.missing.length - b.candidate.missing.length ||
      b.preferenceMatches - a.preferenceMatches ||
      b.candidate.coverage - a.candidate.coverage ||
      a.candidate.recipeId.localeCompare(b.candidate.recipeId)
    )
    .slice(0, Math.max(0, Math.min(3, limit)))
    .map(({ candidate, resurfaceItems }) => ({
      recipeId: candidate.recipeId,
      title: candidate.title,
      imageUrl: candidate.imageUrl,
      totalMinutes: candidate.totalMinutes,
      have: candidate.have,
      missing: candidate.missing,
      canMakeNow: candidate.canMakeNow,
      resurfaceItems,
      reason: planReason(candidate, resurfaceItems),
    }));
}

function planReason(candidate: PlanTogetherCandidate, resurfaceItems: string[]): string {
  if (resurfaceItems.length > 0) {
    return `Uses ${readableList(resurfaceItems)}, which may be worth checking while you plan.`;
  }
  if (candidate.canMakeNow) return "Looks possible with what your pantry currently says you have.";
  if (candidate.missing.length === 1) return `Close match. Your pantry is missing ${candidate.missing[0]}.`;
  return `Close match. Your pantry is missing ${readableList(candidate.missing.slice(0, 3))}${candidate.missing.length > 3 ? " and a few more items" : ""}.`;
}

function readableList(items: readonly string[]): string {
  if (items.length < 2) return items[0] ?? "an ingredient";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}
