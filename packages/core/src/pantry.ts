import type { Ingredient } from "./recipe.js";
import { isStaple } from "./staples.js";
import { parseIngredientLine } from "./units.js";

/**
 * "What can I make from what's in my kitchen."
 *
 * The rules live here as pure functions so they can be tested without a
 * database, and so the SQL that implements them at scale has something
 * authoritative to agree with.
 */

export interface PantryEntry {
  canonicalItem: string;
  displayName: string;
  quantity: number | null;
  unit: string | null;
  /** Always on hand. Staples are assumed present unless explicitly marked out. */
  isStaple: boolean;
}

/** What a recipe needs, reduced to the form matching cares about. */
export interface RecipeRequirements {
  recipeId: string;
  /** Non-optional, non-staple canonical items. These decide whether you can cook it. */
  required: string[];
  /** Nice-to-haves; missing ones are reported but never block a match. */
  optional: string[];
  /** Salt, oil, and friends. Assumed present, listed separately for honesty. */
  staples: string[];
}

export interface PantryMatch {
  recipeId: string;
  have: string[];
  missing: string[];
  /** Optional ingredients you don't have — worth showing, never disqualifying. */
  missingOptional: string[];
  /** Staples the recipe needs that you've explicitly marked as out. */
  missingStaples: string[];
  /** Fraction of required ingredients you have, 0-1. */
  coverage: number;
  canMakeNow: boolean;
}

/**
 * How many missing ingredients still counts as "nearly there". Beyond this a
 * result stops being a suggestion and starts being a shopping trip.
 */
export const NEARLY_THERE_LIMIT = 3;

/** Reduce a recipe's ingredient list to the three buckets matching works on. */
export function requirementsFor(recipeId: string, ingredients: Ingredient[]): RecipeRequirements {
  const required = new Set<string>();
  const optional = new Set<string>();
  const staples = new Set<string>();

  for (const ing of ingredients) {
    const item = ing.canonicalItem.trim();
    if (!item) continue;

    if (isStaple(item)) staples.add(item);
    else if (ing.optional) optional.add(item);
    else required.add(item);
  }

  return {
    recipeId,
    required: [...required],
    optional: [...optional],
    staples: [...staples],
  };
}

export interface MatchOptions {
  /** Canonical items the user has. */
  pantry: Set<string>;
  /** Staples the user has explicitly said they're out of. */
  missingStaples?: Set<string>;
}

/** Score one recipe against a pantry. */
export function matchRecipe(
  requirements: RecipeRequirements,
  { pantry, missingStaples = new Set() }: MatchOptions,
): PantryMatch {
  const have = requirements.required.filter((item) => pantry.has(item));
  const missing = requirements.required.filter((item) => !pantry.has(item));

  return {
    recipeId: requirements.recipeId,
    have,
    missing,
    missingOptional: requirements.optional.filter((item) => !pantry.has(item)),
    // A staple only counts against you if you've said you're out of it.
    missingStaples: requirements.staples.filter((item) => missingStaples.has(item)),
    // A recipe with no required ingredients (everything staple or optional) is
    // cookable, and 1 is the honest coverage for "nothing was needed".
    coverage: requirements.required.length === 0 ? 1 : have.length / requirements.required.length,
    canMakeNow: missing.length === 0,
  };
}

/**
 * Best first: things you can cook right now, then things you're closest to,
 * then whatever covers the most of what you already have.
 *
 * `timesCooked` breaks ties toward what someone actually makes, which beats
 * alphabetical or newest-first for a "what's for dinner" list.
 */
export function rankMatches<T extends PantryMatch>(
  matches: T[],
  timesCooked: Map<string, number> = new Map(),
): T[] {
  return [...matches].sort((a, b) => {
    if (a.canMakeNow !== b.canMakeNow) return a.canMakeNow ? -1 : 1;
    if (a.missing.length !== b.missing.length) return a.missing.length - b.missing.length;
    if (b.coverage !== a.coverage) return b.coverage - a.coverage;
    return (timesCooked.get(b.recipeId) ?? 0) - (timesCooked.get(a.recipeId) ?? 0);
  });
}

/** One line explaining why a recipe is in the list, in the user's terms. */
export function describeMatch(match: PantryMatch): string {
  if (match.missingStaples.length > 0 && match.canMakeNow) {
    return `You have everything except ${formatList(match.missingStaples)}`;
  }
  if (match.canMakeNow) return "You have everything";

  const n = match.missing.length;
  if (n === 1) return `Missing ${match.missing[0]}`;
  if (n <= NEARLY_THERE_LIMIT) return `Missing ${formatList(match.missing)}`;
  return `Missing ${n} ingredients`;
}

function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/**
 * Turn free-typed pantry input into canonical items.
 *
 * People type "2 chicken thighs, rice, a can of chopped tomatoes" — the same
 * shape as an ingredient line, so it goes through the same parser the importer
 * uses. That means the pantry and the recipe index agree on names by
 * construction rather than by coincidence.
 */
export function parsePantryInput(input: string): PantryEntry[] {
  const seen = new Map<string, PantryEntry>();

  for (const raw of input.split(/[,\n;]+/)) {
    const line = raw.trim();
    if (!line) continue;

    const parsed = parseIngredientLine(line);
    const key = parsed.canonicalItem;
    if (!key || seen.has(key)) continue;

    seen.set(key, {
      canonicalItem: key,
      displayName: parsed.item || line,
      quantity: parsed.quantity,
      unit: parsed.unit,
      isStaple: isStaple(key),
    });
  }

  return [...seen.values()];
}
