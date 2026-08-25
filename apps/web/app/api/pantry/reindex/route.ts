import { recanonicalizeRecipes } from "@nomnom/db";
import { withUser } from "@/lib/api";

/**
 * Re-derive canonical ingredient names across the whole collection.
 *
 * Run after the canonicalizer changes: without it, improvements only apply to
 * recipes imported afterwards and the pantry keeps missing the older ones.
 */
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST() {
  return withUser((userId, database) => recanonicalizeRecipes(database, userId));
}
