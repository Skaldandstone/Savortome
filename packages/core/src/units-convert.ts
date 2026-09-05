/**
 * Converting between cooking units, so amounts from different recipes can be
 * added together.
 *
 * Only within a family: 2 tbsp and 1 cup are both volume and combine; 200 g and
 * 1 cup do not, because that depends on what the ingredient is. A shopping list
 * that guesses flour's density to merge two lines is worse than one that shows
 * two lines.
 */

export type UnitFamily = "volume" | "weight" | "count";

/** Multipliers to each family's base unit: ml for volume, g for weight. */
const VOLUME: Record<string, number> = {
  ml: 1,
  l: 1000,
  tsp: 4.92892,
  tbsp: 14.7868,
  floz: 29.5735,
  cup: 236.588,
  pint: 473.176,
  quart: 946.353,
  gallon: 3785.41,
};

const WEIGHT: Record<string, number> = {
  g: 1,
  kg: 1000,
  oz: 28.3495,
  lb: 453.592,
};

/**
 * Anything not a volume or a weight counts discrete things — cloves, cans,
 * bunches, or a bare number. Those never convert into each other (three cloves
 * aren't a fraction of a head), so each keeps its own line.
 */
export function unitFamily(unit: string | null): UnitFamily {
  if (!unit) return "count";
  const u = unit.toLowerCase();
  if (u in VOLUME) return "volume";
  if (u in WEIGHT) return "weight";
  return "count";
}

/** True when two amounts of the same ingredient can be added together. */
export function canCombine(a: string | null, b: string | null): boolean {
  const [fa, fb] = [unitFamily(a), unitFamily(b)];
  if (fa !== fb) return false;
  // Discrete units only combine with themselves — case-insensitively, same
  // as volume and weight already are via the lowercased table lookups in
  // toBase/fromBase. Without this, "clove" and "Clove" (a real difference
  // in casing an LLM extraction can produce, since nothing normalizes a
  // model's own `unit` output the way the deterministic parser's
  // normalizeUnit does) would count as unrelated units.
  if (fa === "count") return (a ?? "").toLowerCase() === (b ?? "").toLowerCase();
  return true;
}

/** Convert to the family's base unit. Returns null when the unit is unknown. */
export function toBase(quantity: number, unit: string | null): number | null {
  const family = unitFamily(unit);
  if (family === "count") return quantity;
  const table = family === "volume" ? VOLUME : WEIGHT;
  const factor = table[(unit ?? "").toLowerCase()];
  return factor === undefined ? null : quantity * factor;
}

/** Convert out of the base unit into `unit`. */
export function fromBase(base: number, unit: string | null): number | null {
  const family = unitFamily(unit);
  if (family === "count") return base;
  const table = family === "volume" ? VOLUME : WEIGHT;
  const factor = table[(unit ?? "").toLowerCase()];
  return factor === undefined ? null : base / factor;
}

/** Express `quantity` of `from` in terms of `to`, or null if they don't relate. */
export function convert(quantity: number, from: string | null, to: string | null): number | null {
  if (!canCombine(from, to)) return null;
  const base = toBase(quantity, from);
  return base === null ? null : fromBase(base, to);
}

/**
 * Round to something a person can measure, and keep the precision sensible for
 * the size of the number.
 */
export function tidyQuantity(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value >= 100) return Math.round(value);
  if (value >= 10) return Math.round(value * 2) / 2;
  // Eighths are the finest division on a measuring cup.
  return Number((Math.round(value * 8) / 8).toFixed(3));
}
