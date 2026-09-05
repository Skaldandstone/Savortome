/**
 * Which part of the shop a thing is in.
 *
 * A merged list is only half the job. Printed in the order recipes happened to
 * contribute, it sends someone from produce to frozen to produce again — so
 * the list is grouped into the sections a supermarket is actually laid out in,
 * in the order most shops are walked.
 *
 * Every ingredient already carries a canonical name — the lowercase singular
 * the pantry and the shopping list join on — which is exactly the key this
 * needs. No new data, no migration, no per-item tagging.
 */

/** In walking order: fresh edges first, middle aisles after, checkout last. */
export const AISLES = [
  "produce",
  "meat",
  "dairy",
  "bakery",
  "frozen",
  "pantry",
  "drinks",
  "other",
] as const;

export type Aisle = (typeof AISLES)[number];

export const AISLE_LABEL: Record<Aisle, string> = {
  produce: "Produce",
  meat: "Meat & fish",
  dairy: "Dairy & eggs",
  bakery: "Bakery",
  frozen: "Frozen",
  pantry: "Pantry",
  drinks: "Drinks",
  other: "Anything else",
};

/**
 * Words that place an item, checked whole rather than as substrings.
 *
 * Substring matching is what makes this kind of table quietly wrong: "grape"
 * inside "grapeseed oil" puts a bottle of oil in produce, and "cream" inside
 * "cream of tartar" puts a raising agent in the fridge. Matching whole words
 * against the canonical name avoids the whole class.
 *
 * Order matters — the first aisle whose words match wins — so the specific
 * lists come before the broad ones.
 */
const AISLE_WORDS: [Aisle, string[]][] = [
  // Checked first: these all contain a word that would otherwise pull them
  // into produce, dairy or meat.
  ["pantry", [
    "oil", "vinegar", "sauce", "paste", "stock", "broth", "flour", "sugar", "syrup", "honey",
    "rice", "pasta", "noodle", "lentil", "bean", "chickpea", "oat", "cereal", "tin", "can",
    "salt", "pepper", "spice", "powder", "extract", "essence", "yeast", "soda", "cornstarch",
    "tartar", "canned", "tinned", "jarred", "dried", "bouillon", "saffron", "turmeric",
    "cardamom", "nutmeg", "soy", "hoisin", "pickle", "chutney", "marmalade", "treacle",
    "cornmeal", "polenta", "semolina", "couscous", "quinoa", "barley", "bulgur", "oatmeal",
    "granola", "sultana", "prune",
    "cornflour", "cocoa", "chocolate", "nut", "almond", "walnut", "pecan", "cashew", "peanut",
    "seed", "sesame", "tahini", "miso", "gochujang", "curry", "cumin", "paprika", "cinnamon",
    "oregano", "thyme", "bay", "vanilla", "mustard", "ketchup", "mayonnaise", "jam", "raisin",
    "date", "apricot", "coconut", "breadcrumb", "cracker", "tortilla", "wrap", "gelatin",
    "baking", "molasses", "tamari", "worcestershire", "sriracha", "harissa", "pesto", "olive",
    "caper", "anchovy", "tuna", "sardine", "passata", "puree", "concentrate",
  ]],
  ["frozen", ["frozen", "ice", "peas"]],
  ["dairy", [
    "milk", "cream", "butter", "cheese", "yogurt", "yoghurt", "egg", "eggs", "feta", "mozzarella",
    "parmesan", "cheddar", "ricotta", "mascarpone", "creme", "custard", "ghee", "buttermilk",
    "tofu", "paneer",
  ]],
  ["meat", [
    "chicken", "beef", "pork", "lamb", "bacon", "sausage", "mince", "steak", "chop", "thigh",
    "breast", "wing", "belly", "shoulder", "brisket", "ham", "salami", "chorizo", "prosciutto",
    "turkey", "duck", "fish", "salmon", "cod", "haddock", "prawn", "shrimp", "squid", "mussel",
    "clam", "scallop", "crab", "lobster",
  ]],
  ["bakery", ["bread", "loaf", "bun", "roll", "baguette", "sourdough", "pitta", "pita", "brioche", "croissant", "bagel", "muffin"]],
  ["drinks", ["wine", "beer", "cider", "juice", "water", "cola", "lemonade", "coffee", "tea", "stout", "vermouth", "sherry", "brandy", "rum", "whisky", "whiskey", "vodka", "gin"]],
  ["produce", [
    "onion", "shallot", "garlic", "ginger", "carrot", "celery", "potato", "tomato", "pepper",
    "chilli", "chili", "cucumber", "lettuce", "spinach", "kale", "cabbage", "broccoli",
    "cauliflower", "courgette", "zucchini", "aubergine", "eggplant", "mushroom", "leek",
    "pumpkin", "squash", "corn", "asparagus", "bean", "pea", "radish", "beet", "beetroot",
    "turnip", "parsnip", "sprout", "lemon", "lime", "orange", "apple", "banana", "pear",
    "grape", "berry", "strawberry", "raspberry", "blueberry", "mango", "avocado", "pineapple",
    "peach", "plum", "cherry", "melon", "rhubarb", "parsley", "coriander", "cilantro", "basil",
    "mint", "dill", "chive", "rosemary", "sage", "tarragon", "scallion", "herb", "salad",
    "green", "lettuce", "rocket", "arugula", "watercress", "sweetcorn", "kimchi",
  ]],
];

/**
 * A handful of compounds where the qualifying word changes the aisle a bare
 * keyword below would otherwise pick, checked before that list rather than
 * added to it — "pepper" alone means the pantry spice in the list below (it
 * has to, or "black pepper" and "pepper flakes" would end up in produce),
 * but "bell pepper" is never anything but the fresh vegetable; "bean" alone
 * means a canned or dried one, but "green bean" is never anything but the
 * fresh one.
 */
const COMPOUND_OVERRIDES: [Aisle, string, string][] = [
  ["produce", "bell", "pepper"],
  ["produce", "green", "bean"],
  ["produce", "string", "bean"],
  ["produce", "runner", "bean"],
];

/**
 * Which aisle an ingredient belongs in.
 *
 * Falls back to "other" rather than guessing. An unknown item at the end of
 * the list is a small annoyance; the same item confidently filed under Frozen
 * sends someone to the wrong end of the shop.
 */
export function aisleFor(canonicalItem: string, displayName = ""): Aisle {
  // Both names, because the canonical name can lose the word that places an
  // item: the canonicalizer strips "frozen" as prep, so a bag of frozen peas
  // canonicalises to "pea" and would be filed in produce. A shopping line's
  // display name is the shortest contributing name and so rarely helps, but a
  // hand-typed pantry entry keeps the wording the person actually used.
  const words = new Set(
    `${canonicalItem} ${displayName}`
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter(Boolean),
  );
  if (words.size === 0) return "other";

  for (const [aisle, a, b] of COMPOUND_OVERRIDES) {
    if (words.has(a) && words.has(b)) return aisle;
  }

  for (const [aisle, keywords] of AISLE_WORDS) {
    if (keywords.some((word) => words.has(word))) return aisle;
  }
  return "other";
}

/**
 * Group a list into shop sections, in walking order.
 *
 * Empty sections are dropped — a heading with nothing under it is noise on a
 * list you're reading one-handed with a trolley.
 */
export function groupByAisle<T extends { canonicalItem: string; displayName?: string }>(
  lines: readonly T[],
): { aisle: Aisle; label: string; items: T[] }[] {
  const byAisle = new Map<Aisle, T[]>();
  for (const line of lines) {
    const aisle = aisleFor(line.canonicalItem, line.displayName ?? "");
    byAisle.set(aisle, [...(byAisle.get(aisle) ?? []), line]);
  }

  return AISLES.filter((aisle) => byAisle.has(aisle)).map((aisle) => ({
    aisle,
    label: AISLE_LABEL[aisle],
    items: byAisle.get(aisle) as T[],
  }));
}
