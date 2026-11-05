/** A name-only review, never a recipe amount or purchase instruction. */
export function mealShoppingNames(missing: readonly string[]): string[] {
  return [...new Set(missing.map(name => name.trim()).filter(name => name.length > 0 && name.length <= 200))].slice(0, 100);
}

/** Confirms only the selected names, never quantities, check marks or inventory. */
export function mealShoppingReceiptMatches(names: readonly string[], receipt: unknown): boolean {
  if (!names.length || !receipt || typeof receipt !== "object") return false;
  const items = (receipt as { items?: unknown }).items;
  if (!Array.isArray(items)) return false;
  return names.every(name => items.some(item => item && typeof item === "object" &&
    typeof item.id === "string" && item.id.length > 0 && item.canonicalItem === name));
}
