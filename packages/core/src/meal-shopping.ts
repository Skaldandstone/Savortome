/** A name-only review, never a recipe amount or purchase instruction. */
export function mealShoppingNames(missing: readonly string[]): string[] {
  return [...new Set(missing.map(name => name.trim()).filter(name => name.length > 0 && name.length <= 200))].slice(0, 100);
}
