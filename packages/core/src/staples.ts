/**
 * Ingredients the pantry matcher assumes are present without being told.
 *
 * The line is **shelf-stable seasoning, baking, and cooking basics** — things
 * a stocked kitchen has and rarely thinks about. Perishables are deliberately
 * excluded, even near-universal ones like eggs, milk, butter, onions, and
 * garlic: people genuinely run out of those, and a match that says "you can
 * make this" when you can't is the failure that stops the feature being
 * trusted. Being told you're missing salt is a much cheaper mistake.
 *
 * A cook can still mark anything as always-on-hand on their own pantry, which
 * is what `pantry_items.is_staple` is for.
 */
export const STAPLE_ITEMS = new Set([
  // Seasoning
  "salt", "kosher salt", "sea salt", "black pepper", "pepper", "white pepper",
  "garlic powder", "onion powder", "paprika", "smoked paprika", "cumin",
  "dried oregano", "dried basil", "dried thyme", "chili powder", "cinnamon",
  "nutmeg", "red pepper flake", "bay leaf", "italian seasoning",

  // Fats and cooking liquids
  "olive oil", "extra virgin olive oil", "vegetable oil", "canola oil",
  "cooking spray", "sesame oil", "water", "ice",

  // Baking and dry goods
  "sugar", "granulated sugar", "brown sugar", "powdered sugar",
  "all purpose flour", "flour", "baking soda", "baking powder", "cornstarch",
  "vanilla extract",

  // Shelf-stable condiments
  "soy sauce", "vinegar", "white vinegar", "apple cider vinegar",
  "rice vinegar", "balsamic vinegar", "honey", "hot sauce",
]);

export const isStaple = (canonicalItem: string): boolean =>
  STAPLE_ITEMS.has(canonicalItem.trim().toLowerCase());
