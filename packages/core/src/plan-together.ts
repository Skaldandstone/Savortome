import { flagsForRecipe, type DietaryProfile } from "./dietary.js";
import { pantryAttention } from "./pantry-guidance.js";
import type { PantryEntry, PantryMatch } from "./pantry.js";
import { canonicalize } from "./units.js";

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

/** Explicit planning limits, not inferred energy or cooking difficulty. */
export interface PlanTogetherOptions {
  strictDietary?: boolean;
  maxMinutes?: 10 | 20 | 30 | 60;
  pantryOnly?: boolean;
  /** Temporary names, normalized by the input parser before ranking; never saved as dietary settings. */
  useIngredient?: string;
  skipIngredient?: string;
}

export function planIngredientName(value: string | null | undefined): string | undefined {
  if (value == null || value.trim() === "") return undefined;
  if (value.length > 100 || /[\u0000-\u001f\u007f,;]|\bor\b/i.test(value)) throw new Error("Enter one ingredient name, up to 100 characters, without alternatives.");
  const name = canonicalize(value.trim());
  if (!name) throw new Error("Enter an ingredient name.");
  return name;
}

export function parsePlanTogetherOptions(params: URLSearchParams): PlanTogetherOptions {
  if (["maxMinutes", "pantryOnly", "strictDietary", "useIngredient", "skipIngredient"].some(key => params.getAll(key).length > 1)) throw new Error("Choose one value for each meal-planning limit.");
  const rawTime = params.get("maxMinutes");
  const rawPantry = params.get("pantryOnly");
  const rawDietary = params.get("strictDietary");
  if (rawTime !== null && !["10", "20", "30", "60"].includes(rawTime)) throw new Error("Choose a supported meal-planning time limit.");
  if (rawPantry !== null && rawPantry !== "true" && rawPantry !== "false") throw new Error("Choose whether to use pantry matches only.");
  if (rawDietary !== null && rawDietary !== "true" && rawDietary !== "false") throw new Error("Choose a valid dietary matching setting.");
  return { strictDietary: rawDietary === "true", pantryOnly: rawPantry === "true", maxMinutes: rawTime === null ? undefined : Number(rawTime) as PlanTogetherOptions["maxMinutes"], useIngredient: planIngredientName(params.get("useIngredient")), skipIngredient: planIngredientName(params.get("skipIngredient")) };
}

/** JSON callers keep temporary food choices out of URLs and access-log queries. */
export function parsePlanTogetherInput(value: unknown): PlanTogetherOptions {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Review your meal-planning choices.");
  const input = value as Record<string, unknown>;
  const params = new URLSearchParams();
  for (const key of ["strictDietary", "pantryOnly"] as const) {
    if (input[key] !== undefined) {
      if (typeof input[key] !== "boolean") throw new Error("Choose a valid matching setting.");
      params.set(key, String(input[key]));
    }
  }
  if (input.maxMinutes !== undefined) {
    if (typeof input.maxMinutes !== "number") throw new Error("Choose a supported time limit.");
    params.set("maxMinutes", String(input.maxMinutes));
  }
  for (const key of ["useIngredient", "skipIngredient"] as const) {
    if (input[key] !== undefined) {
      if (typeof input[key] !== "string") throw new Error("Enter one ingredient name.");
      params.set(key, input[key]);
    }
  }
  return parsePlanTogetherOptions(params);
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
  options: PlanTogetherOptions = {},
): PlanTogetherIdea[] {
  const pantryByName = new Map(pantry.map(entry => [entry.canonicalItem, entry]));
  const taggedPreferences = new Set<string>(profile.dietaryTags);
  // The boundary parser already canonicalizes names. Do not singularize an
  // already-normalized name a second time (normalization is not idempotent for
  // every possible user-supplied word).
  const useIngredient = options.useIngredient;
  const skipIngredient = options.skipIngredient;

  return candidates
    // A conflicting use/skip request deliberately returns no choices. Do not
    // weaken either preference or treat a name exclusion as allergy safety.
    .filter(candidate => !useIngredient || candidate.ingredients.includes(useIngredient))
    .filter(candidate => !skipIngredient || !candidate.ingredients.includes(skipIngredient))
    // Search normally assumes staples. A no-shopping request cannot rely on
    // that assumption: require every indexed name, even optional ingredients.
    // An empty ingredient index is not evidence that nothing is needed.
    .filter(candidate => !options.pantryOnly || (candidate.ingredients.length > 0 && candidate.missing.length === 0 && candidate.ingredients.every(item => pantryByName.has(item))))
    // Unknown times never satisfy a selected limit. Include elapsed waiting
    // time from the saved recipe; never substitute active preparation time.
    .filter(candidate => options.maxMinutes === undefined || (candidate.totalMinutes !== null && Number.isFinite(candidate.totalMinutes) && candidate.totalMinutes >= 0 && candidate.totalMinutes <= options.maxMinutes))
    .filter(candidate => !options.strictDietary || profile.dietaryTags.every(tag => candidate.tags.includes(tag)))
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
