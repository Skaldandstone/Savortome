import type { Ingredient } from "./recipe.js";
import type { PantryEntry } from "./pantry.js";
import { isStaple } from "./staples.js";
import { formatAmount } from "./units.js";
import { canCombine, convert, tidyQuantity, unitFamily } from "./units-convert.js";

/**
 * Turning recipes into a shopping list.
 *
 * The work is merging: three recipes wanting flour should be one line, and
 * anything already in the kitchen shouldn't be on the list at all. Amounts only
 * combine when their units genuinely relate — see `units-convert.ts`.
 */

export interface ShoppingLine {
  canonicalItem: string;
  /** What to show on the list — the clearest of the contributing names. */
  displayName: string;
  quantity: number | null;
  unit: string | null;
  /** Recipes that asked for this. Lets the UI say why a line is there. */
  recipeIds: string[];
  /** True when nothing stated an amount, so the shopper decides. */
  amountUnknown: boolean;
  /**
   * Set when the pantry holds this item but in units that can't be compared —
   * "you have some, we couldn't work out how much".
   */
  mayAlreadyHave: boolean;
  checked: boolean;
}

export interface BuildListOptions {
  /** Skip anything already in the kitchen. */
  pantry?: PantryEntry[];
  /** Leave staples off the list; most people don't shop for salt. */
  skipStaples?: boolean;
  /** Leave out ingredients the recipe marked optional. */
  skipOptional?: boolean;
}

interface Contribution {
  ingredient: Ingredient;
  recipeId: string;
}

/**
 * One bucket per (item, compatible unit). Two lines of the same ingredient in
 * unrelated units stay separate rather than being guessed at.
 */
interface Bucket {
  canonicalItem: string;
  unit: string | null;
  names: string[];
  quantity: number | null;
  recipeIds: Set<string>;
  sawUnknownAmount: boolean;
}

function bucketKey(canonicalItem: string, unit: string | null): string {
  const family = unitFamily(unit);
  // Volume and weight merge across their whole family; counts only with
  // themselves, so the exact unit is part of the key.
  return family === "count"
    ? `${canonicalItem}::count::${unit ?? ""}`
    : `${canonicalItem}::${family}`;
}

/**
 * Pick the name to write on the list.
 *
 * Recipe wording carries prep, alternatives, and footnote markers — "melted
 * coconut oil or extra-virgin olive oil or high quality vegetable oil*" — none
 * of which help in a shop. The canonical name is usually the plainest, so it
 * competes with the recipes' own wording and the shortest wins.
 */
function bestName(names: string[], canonicalItem: string): string {
  const candidates = [canonicalItem, ...names].map((n) => n.trim()).filter(Boolean);
  if (candidates.length === 0) return canonicalItem;

  return candidates.sort(
    (a, b) => a.length - b.length || (a === canonicalItem ? -1 : 1),
  )[0]!;
}

function addToBucket(bucket: Bucket, ingredient: Ingredient, recipeId: string): void {
  bucket.names.push(ingredient.item || ingredient.raw);
  bucket.recipeIds.add(recipeId);

  if (ingredient.quantity === null) {
    // "salt to taste" contributes no number, but does mean the item is needed.
    bucket.sawUnknownAmount = true;
    return;
  }

  // Ranges shop for the larger amount — running short is worse than leftovers.
  const amount = ingredient.quantityMax ?? ingredient.quantity;
  const inBucketUnit = convert(amount, ingredient.unit, bucket.unit);

  if (inBucketUnit === null) {
    bucket.sawUnknownAmount = true;
    return;
  }
  bucket.quantity = (bucket.quantity ?? 0) + inBucketUnit;
}

/**
 * Does the kitchen hold this item in units that can't be compared to what the
 * recipe asked for? Exported because a stored list is re-flagged when it's
 * read, rather than the answer being frozen at the moment it was built.
 */
export function pantryMayCover(line: ShoppingLine, pantry: PantryEntry[]): boolean {
  const held = pantry.find((p) => p.canonicalItem === line.canonicalItem);
  if (!held || held.quantity === null) return false;
  return line.quantity === null || !canCombine(held.unit, line.unit);
}

/** Subtract what the kitchen already holds. Returns null when nothing is needed. */
function applyPantry(
  line: ShoppingLine,
  pantry: Map<string, PantryEntry>,
): ShoppingLine | null {
  const held = pantry.get(line.canonicalItem);
  if (!held) return line;

  // No amount recorded means "I have this" — don't put it on the list.
  if (held.quantity === null) return null;

  if (line.quantity === null || !canCombine(held.unit, line.unit)) {
    // Can't compare, so still buy it, but say why it might be unnecessary.
    return { ...line, mayAlreadyHave: true };
  }

  const heldInLineUnit = convert(held.quantity, held.unit, line.unit) ?? 0;
  const shortfall = line.quantity - heldInLineUnit;
  if (shortfall <= 0) return null;

  return { ...line, quantity: tidyQuantity(shortfall) };
}

/**
 * Build a shopping list from a set of recipes.
 *
 * `recipes` is a map of recipe id to its ingredients, so the resulting lines
 * can point back at what asked for them.
 */
export function buildShoppingList(
  recipes: Map<string, Ingredient[]>,
  options: BuildListOptions = {},
): ShoppingLine[] {
  const { pantry = [], skipStaples = true, skipOptional = true } = options;

  const contributions: Contribution[] = [];
  for (const [recipeId, ingredients] of recipes) {
    for (const ingredient of ingredients) {
      const item = ingredient.canonicalItem.trim();
      if (!item) continue;
      if (skipStaples && isStaple(item)) continue;
      if (skipOptional && ingredient.optional) continue;
      contributions.push({ ingredient, recipeId });
    }
  }

  const buckets = new Map<string, Bucket>();
  for (const { ingredient, recipeId } of contributions) {
    const item = ingredient.canonicalItem.trim();
    const key = bucketKey(item, ingredient.unit);

    let bucket = buckets.get(key);
    if (!bucket) {
      // The first contribution sets the unit everything else converts into,
      // which keeps the list in units the recipes actually used.
      bucket = {
        canonicalItem: item,
        unit: ingredient.unit,
        names: [],
        quantity: null,
        recipeIds: new Set(),
        sawUnknownAmount: false,
      };
      buckets.set(key, bucket);
    }
    addToBucket(bucket, ingredient, recipeId);
  }

  const pantryByItem = new Map(pantry.map((p) => [p.canonicalItem, p]));

  const lines: ShoppingLine[] = [];
  for (const bucket of buckets.values()) {
    const line: ShoppingLine = {
      canonicalItem: bucket.canonicalItem,
      displayName: bestName(bucket.names, bucket.canonicalItem),
      quantity: bucket.quantity === null ? null : tidyQuantity(bucket.quantity),
      unit: bucket.quantity === null ? null : bucket.unit,
      recipeIds: [...bucket.recipeIds],
      amountUnknown: bucket.sawUnknownAmount,
      mayAlreadyHave: false,
      checked: false,
    };

    const afterPantry = applyPantry(line, pantryByItem);
    if (afterPantry) lines.push(afterPantry);
  }

  return lines.sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/**
 * The plain-text form, for the providers with no API — clipboard, share sheet,
 * or a notes app. One item per line, amounts first.
 */
export function formatListAsText(lines: ShoppingLine[]): string {
  return lines
    .filter((l) => !l.checked)
    .map((l) => {
      // Same wording as the on-screen list, so a copied list and the app agree.
      const amount = formatAmount(l);
      return amount ? `${amount} ${l.displayName}` : l.displayName;
    })
    .join("\n");
}
