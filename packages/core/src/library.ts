/**
 * How a collection of recipes is ordered and summarised.
 *
 * Newest-first is the right default — the thing you just saved is the thing
 * you're most likely looking for — but it stops being useful the moment the
 * library outgrows a screen, which is what the rest of these are for.
 */

export const LIBRARY_SORTS = ["newest", "name", "quickest", "rated", "cooked"] as const;
export type LibrarySort = (typeof LIBRARY_SORTS)[number];

export const LIBRARY_SORT_LABEL: Record<LibrarySort, string> = {
  newest: "Newest",
  name: "A–Z",
  quickest: "Quickest",
  rated: "Best rated",
  cooked: "Recently cooked",
};

export const DEFAULT_LIBRARY_SORT: LibrarySort = "newest";

export const isLibrarySort = (value: string | null | undefined): value is LibrarySort =>
  typeof value === "string" && (LIBRARY_SORTS as readonly string[]).includes(value);

/** Fall back rather than throw: a hand-edited URL shouldn't be an error page. */
export const librarySortOr = (value: string | null | undefined): LibrarySort =>
  isLibrarySort(value) ? value : DEFAULT_LIBRARY_SORT;

/** What this person thought of a recipe, as the library card shows it. */
export interface RecipeStanding {
  /** 0 when cooked but never rated — a real state, not a missing one. */
  stars: number;
  timesCooked: number;
  lastCookedAt: string | null;
}

/**
 * "Cooked twice", "Cooked once", or nothing.
 *
 * A count of zero is left unsaid rather than written out: a card that
 * announces "cooked 0 times" is nagging, not informing.
 */
export function cookedLabel(timesCooked: number): string | null {
  if (timesCooked <= 0) return null;
  if (timesCooked === 1) return "Cooked once";
  if (timesCooked === 2) return "Cooked twice";
  return `Cooked ${timesCooked} times`;
}
