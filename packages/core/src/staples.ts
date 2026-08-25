/**
 * Ingredients almost every kitchen has. The pantry matcher treats these as
 * present unless the user says otherwise, so "I have chicken and rice" doesn't
 * fail to match a recipe purely because it also calls for salt.
 */
export const STAPLE_ITEMS = new Set([
  "salt", "kosher salt", "sea salt", "black pepper", "pepper", "water",
  "olive oil", "vegetable oil", "canola oil", "cooking spray", "butter",
  "sugar", "granulated sugar", "brown sugar", "all purpose flour", "flour",
  "baking soda", "baking powder", "vanilla extract", "garlic", "onion",
  "garlic powder", "onion powder", "paprika", "cumin", "dried oregano",
  "chili powder", "cinnamon", "red pepper flake", "bay leaf",
  "soy sauce", "vinegar", "white vinegar", "apple cider vinegar", "honey",
  "egg", "milk", "cornstarch", "ice",
]);

export const isStaple = (canonicalItem: string): boolean =>
  STAPLE_ITEMS.has(canonicalItem.trim().toLowerCase());
