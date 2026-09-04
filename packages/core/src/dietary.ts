/**
 * Dietary preferences and allergies — soft steering versus a hard stop.
 *
 * A preference (vegetarian, gluten-free) is something a suggestion should
 * lean toward; an allergy is something it should never quietly ignore. Both
 * are guessed from ingredient names by keyword, the same shape as
 * `courseBucket` in `pairing.ts` and `isStaple` in `staples.ts` — cheap,
 * approximate, and honest about it. This is not a medical device: it never
 * asserts a recipe is safe, only that it might contain something worth a
 * second look, and every place it renders carries that disclaimer.
 */

export const DIETARY_TAGS = [
  "vegetarian", "vegan", "pescatarian", "gluten-free", "dairy-free", "keto", "halal", "kosher",
] as const;
export type DietaryTag = (typeof DIETARY_TAGS)[number];

export const DIETARY_TAG_LABEL: Record<DietaryTag, string> = {
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  pescatarian: "Pescatarian",
  "gluten-free": "Gluten-free",
  "dairy-free": "Dairy-free",
  keto: "Keto",
  halal: "Halal",
  kosher: "Kosher",
};

/** The FDA's major food allergens, plus sesame — the closest thing to a standard list. */
export const ALLERGENS = [
  "milk", "eggs", "fish", "shellfish", "tree-nuts", "peanuts", "wheat", "soy", "sesame",
] as const;
export type Allergen = (typeof ALLERGENS)[number];

export const ALLERGEN_LABEL: Record<Allergen, string> = {
  milk: "Milk",
  eggs: "Eggs",
  fish: "Fish",
  shellfish: "Shellfish",
  "tree-nuts": "Tree nuts",
  peanuts: "Peanuts",
  wheat: "Wheat",
  soy: "Soy",
  sesame: "Sesame",
};

export interface DietaryProfile {
  dietaryTags: DietaryTag[];
  allergens: Allergen[];
}

export const ALLERGEN_DISCLAIMER =
  "Guessed from ingredient names, not verified against real allergen or nutrition data — always check the actual ingredients and packaging yourself.";

/**
 * Keyword -> allergen, matched as a whole word in the canonical ingredient
 * name (never a bare substring — see `matchesWord` below). Deliberately
 * small and specific: a false negative here is "the app missed one," which
 * the disclaimer already covers; a false positive on a word too generic to
 * trust would train someone to stop reading the warning at all, which is
 * the worse failure for something safety-adjacent.
 */
const ALLERGEN_KEYWORDS: Record<Allergen, string[]> = {
  milk: ["milk", "cheese", "cream", "yogurt", "yoghurt", "ghee", "whey", "casein", "buttermilk"],
  eggs: ["egg"],
  fish: ["salmon", "tuna", "cod", "anchovy", "anchovies", "sardine", "halibut", "trout", "fish sauce", "fish"],
  shellfish: [
    "shellfish", "shrimp", "prawn", "crab", "lobster", "scallop", "clam", "mussel", "oyster", "squid", "calamari",
  ],
  "tree-nuts": [
    "almond", "walnut", "cashew", "pecan", "pistachio", "hazelnut", "macadamia", "brazil nut", "pine nut",
  ],
  peanuts: ["peanut"],
  wheat: ["wheat", "flour", "bread", "pasta", "noodle", "couscous", "breadcrumb", "panko", "semolina"],
  soy: ["soy", "tofu", "edamame", "tempeh", "miso"],
  sesame: ["sesame", "tahini"],
};

/**
 * A bare substring check would flag "eggplant" as eggs and "buckwheat" as
 * wheat — real, common, unrelated ingredients that happen to contain an
 * allergen word as part of a longer one. Matching on a word boundary instead
 * means the keyword has to appear as its own word, not embedded in another.
 */
function matchesWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`).test(text);
}

/**
 * Words whose allergen meaning a plant-based modifier cancels out. "Butter"
 * alone would flag peanut butter, cocoa butter, shea butter, and apple
 * butter as dairy; "milk" alone would flag coconut, almond, oat, and soy
 * milk the same way. Both are worse than missing the real thing, since a
 * wrong warning is exactly what teaches someone to stop reading the
 * disclaimer — and the nut-based versions are already caught by their own
 * allergen regardless.
 */
const NON_DAIRY_MODIFIERS: Partial<Record<Allergen, string[]>> = {
  milk: ["coconut", "almond", "cashew", "oat", "soy", "rice", "hemp", "pea"],
  wheat: ["buckwheat", "almond", "coconut", "rice", "oat", "chickpea", "corn", "cassava", "tapioca"],
};
const NON_DAIRY_BUTTERS = ["peanut", "almond", "cashew", "cocoa", "shea", "apple", "sunflower", "seed"];

/**
 * The reverse shape of `NON_DAIRY_BUTTERS`: there the modifier comes before
 * "butter" ("peanut butter"); here "butter" comes first and modifies a food
 * that has nothing to do with dairy — a butter bean is a lima bean, and
 * butter lettuce is a lettuce variety.
 */
const BUTTER_NOT_DAIRY_PHRASES = [/\bbutter\s*beans?\b/, /\bbutter\s*lettuce\b/];

/**
 * The ingredient's own name saying it's free of an allergen is the strongest
 * signal available that a keyword match for that exact allergen is wrong,
 * not a real hit — "gluten-free bread" and "dairy-free cream cheese" are
 * named specifically because they *don't* contain what they'd otherwise be
 * flagged for. "Cream of tartar" and "cream soda" aren't dairy at all
 * despite the name, which "vegan"/"non-dairy" alone wouldn't catch, so
 * those get their own exact phrases. Scoped to the two allergens this was
 * actually observed to misfire on; extend it if another one turns up the
 * same way.
 */
const LABELED_FREE_OF: Partial<Record<Allergen, RegExp>> = {
  milk: /\b(?:dairy|milk)[\s-]?free\b|\bnon-?dairy\b|\bvegan\b|\bcream\s+of\s+tartar\b|\bcream\s+soda\b/,
  wheat: /\b(?:gluten|wheat)[\s-]?free\b/,
};

/** Which of a viewer's flagged allergens might be in one ingredient's name. */
export function allergensIn(canonicalItem: string): Allergen[] {
  const text = canonicalItem.toLowerCase();
  const found = ALLERGENS.filter((allergen) => {
    if (!ALLERGEN_KEYWORDS[allergen].some((word) => matchesWord(text, word))) return false;
    if (LABELED_FREE_OF[allergen]?.test(text)) return false;
    const modifiers = NON_DAIRY_MODIFIERS[allergen];
    return !modifiers?.some((word) => matchesWord(text, word));
  });

  if (
    matchesWord(text, "butter") &&
    !found.includes("milk") &&
    !NON_DAIRY_BUTTERS.some((word) => matchesWord(text, word)) &&
    !BUTTER_NOT_DAIRY_PHRASES.some((phrase) => phrase.test(text)) &&
    !LABELED_FREE_OF.milk!.test(text)
  ) {
    found.push("milk");
  }

  return found;
}

/** One ingredient that might trip up one of the viewer's flagged allergens. */
export interface AllergenFlag {
  canonicalItem: string;
  allergen: Allergen;
  optional: boolean;
}

/**
 * Every ingredient in a recipe that might contain one of the given allergens.
 * Empty when the viewer has none flagged, or none of theirs show up — a
 * recipe with no flags shown is not a promise that it's safe, just that
 * nothing matched the keyword list.
 */
export function flagsForRecipe(
  ingredients: readonly { canonicalItem: string; optional: boolean }[],
  watching: readonly Allergen[],
): AllergenFlag[] {
  if (watching.length === 0) return [];
  const set = new Set(watching);
  const flags: AllergenFlag[] = [];
  for (const ing of ingredients) {
    for (const allergen of allergensIn(ing.canonicalItem)) {
      if (set.has(allergen)) flags.push({ canonicalItem: ing.canonicalItem, allergen, optional: ing.optional });
    }
  }
  return flags;
}
