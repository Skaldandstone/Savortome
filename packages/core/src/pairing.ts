/**
 * "Pairs well with" — suggesting a side, a drink, or a dessert from someone's
 * own library to go with a main they're looking at.
 *
 * Deliberately not a model call: it only ever recommends recipes the person
 * already saved, and matching a main to its own library by course and cuisine
 * is something plain code can do for free, instantly, every time the card
 * renders — no credit, no latency, no schema to keep in sync with a prompt.
 */

export type PairingSlot = "side" | "drink" | "dessert";

/** The fields a pairing decision needs — a thin slice of a full recipe row. */
export interface PairingCandidate {
  id: string;
  title: string;
  imageUrl: string | null;
  cuisine: string | null;
  course: string | null;
}

export type PairingSuggestions = Record<PairingSlot, PairingCandidate[]>;

const SLOT_KEYWORDS: Record<PairingSlot, string[]> = {
  side: ["side", "salad", "bread", "vegetable", "starter", "appetizer", "soup"],
  drink: ["drink", "beverage", "cocktail", "mocktail", "smoothie", "juice"],
  dessert: ["dessert", "sweet", "cake", "cookie", "pie", "pastry", "candy"],
};

/**
 * Buckets a recipe's free-text `course` field into a pairing slot. Returns
 * `null` for a main course or anything too ambiguous to place — an unclear
 * recipe is left out of every slot rather than guessed into one.
 */
export function courseBucket(course: string | null): PairingSlot | null {
  if (!course) return null;
  const text = course.toLowerCase();
  for (const slot of Object.keys(SLOT_KEYWORDS) as PairingSlot[]) {
    if (SLOT_KEYWORDS[slot].some((word) => text.includes(word))) return slot;
  }
  return null;
}

/**
 * Suggests up to `limit` recipes per slot from `library` to go alongside
 * `main`. Same-cuisine candidates sort first (an Italian main reaches for an
 * Italian side before an unrelated one); ties fall back to title so the order
 * is stable across renders. `main` itself is always excluded.
 */
export function suggestPairings(
  main: Pick<PairingCandidate, "id" | "cuisine">,
  library: PairingCandidate[],
  limit = 3,
): PairingSuggestions {
  const bySlot: PairingSuggestions = { side: [], drink: [], dessert: [] };

  const scored = new Map<PairingSlot, { candidate: PairingCandidate; sameCuisine: boolean }[]>([
    ["side", []],
    ["drink", []],
    ["dessert", []],
  ]);

  for (const candidate of library) {
    if (candidate.id === main.id) continue;
    const slot = courseBucket(candidate.course);
    if (!slot) continue;
    const sameCuisine = Boolean(main.cuisine) && candidate.cuisine === main.cuisine;
    scored.get(slot)!.push({ candidate, sameCuisine });
  }

  for (const slot of Object.keys(bySlot) as PairingSlot[]) {
    bySlot[slot] = scored
      .get(slot)!
      .sort((a, b) => {
        if (a.sameCuisine !== b.sameCuisine) return a.sameCuisine ? -1 : 1;
        return a.candidate.title.localeCompare(b.candidate.title);
      })
      .slice(0, limit)
      .map((s) => s.candidate);
  }

  return bySlot;
}
