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
  milk: ["milk", "cheese", "cream", "yogurt", "yoghurt", "ghee", "whey", "casein", "buttermilk", "butter"],
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

const VEGAN = /\bvegan\b/;

/**
 * A keyword match for an allergen is wrong, not a real hit, when the
 * ingredient's own name also contains one of these — a plant-based modifier
 * before the keyword ("coconut milk", "almond butter"), a food that only
 * sounds like the allergen ("butter bean", "cream of tartar"), or the name
 * saying outright that it's free of the very thing it would otherwise be
 * flagged for ("gluten-free bread", "vegan cream cheese"). One list per
 * allergen — the next false-positive pattern is one more regex here, not a
 * new kind of mechanism.
 *
 * "Vegan" only goes on the four allergens that exist because an animal was
 * involved (milk, eggs, fish, shellfish); it says nothing about wheat, soy,
 * peanuts, tree nuts, or sesame; a vegan diet can still include all of those.
 */
const EXCLUSIONS: Record<Allergen, RegExp[]> = {
  milk: [
    /\b(?:coconut|almond|cashew|oat|soy|rice|hemp|pea|peanut|cocoa|shea|apple|sunflower|seed)\b/,
    /\bbutter\s*beans?\b/,
    /\bbutter\s*lettuce\b/,
    /\b(?:dairy|milk)[\s-]?free\b/,
    /\bnon-?dairy\b/,
    VEGAN,
    /\bcream\s+of\s+tartar\b/,
    /\bcream\s+soda\b/,
  ],
  eggs: [VEGAN, /\begg[\s-]?free\b/, /\begg\s+(?:replacer|substitute)\b/, /\bflax\s+egg\b/],
  fish: [VEGAN, /\bfish[\s-]?free\b/],
  shellfish: [VEGAN, /\bshellfish[\s-]?free\b/],
  "tree-nuts": [/\b(?:tree[\s-]?)?nut[\s-]?free\b/],
  peanuts: [/\bpeanut[\s-]?free\b/],
  wheat: [
    /\b(?:buckwheat|almond|coconut|rice|oat|chickpea|corn|cassava|tapioca)\b/,
    /\b(?:gluten|wheat)[\s-]?free\b/,
  ],
  soy: [/\bsoy[\s-]?free\b/],
  sesame: [/\bsesame[\s-]?free\b/],
};

/** Which of a viewer's flagged allergens might be in one ingredient's name. */
export function allergensIn(canonicalItem: string): Allergen[] {
  const text = canonicalItem.toLowerCase();
  return ALLERGENS.filter((allergen) => {
    if (!ALLERGEN_KEYWORDS[allergen].some((word) => matchesWord(text, word))) return false;
    return !EXCLUSIONS[allergen].some((exclusion) => exclusion.test(text));
  });
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
