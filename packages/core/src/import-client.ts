import type { Recipe } from "./recipe.js";
import { detectSourceKind } from "./source-kind.js";
import { scaleQuantity } from "./units.js";

/**
 * The client half of the import flow: request/response shapes, the progress
 * vocabulary, and the pure transforms behind serving-size scaling.
 *
 * Deliberately free of React and Node built-ins so the web app and the mobile
 * app share one copy instead of drifting apart.
 */

export interface ImportRequest {
  url?: string;
  text?: string;
  title?: string;
  /** Ignore a site's own recipe data and run the model anyway. */
  forceModel?: boolean;
}

export interface ImportResponse {
  recipe: Recipe;
  trace: string[];
  /** True when the site published its own recipe data and no model call was needed. */
  freeExtraction: boolean;
  saved: boolean;
  saveError: string | null;
}

export interface ImportFailure {
  message: string;
  trace?: string[];
}

export type ImportMode = "url" | "text";

/**
 * The pipeline's phases. A single JSON response can't stream real progress, so
 * clients advance these on a timer — worded so the label on screen matches what
 * the server is plausibly doing, and never claims a stage finished early.
 */
export const IMPORT_STAGES = [
  "Fetching the source",
  "Reading the recipe",
  "Building the card",
] as const;

/** When to advance to each stage after the first, in ms from submit. */
export const IMPORT_STAGE_DELAYS = [1500, 8000] as const;

const SOURCE_HINT: Record<string, string> = {
  youtube: "Pulling captions from YouTube — this one may take a moment.",
  tiktok: "Reading the TikTok caption.",
  instagram: "Reading the Instagram caption.",
  facebook: "Reading the Facebook post.",
  web: "Checking whether the site publishes structured recipe data.",
};

/** Tells the user what we're about to do with this particular link. */
export function hintForUrl(url: string): string | undefined {
  if (!url.trim()) return undefined;
  return SOURCE_HINT[detectSourceKind(url)] ?? SOURCE_HINT.web;
}

/** Looks enough like a link to be worth offering as a one-tap import. */
export function looksLikeUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!/^https?:\/\/\S+$/i.test(trimmed)) return false;
  try {
    new URL(trimmed);
    return true;
  } catch {
    return false;
  }
}

/** Recompute every amount for a different serving count. */
export function scaleIngredients(
  ingredients: Recipe["ingredients"],
  factor: number,
): Recipe["ingredients"] {
  if (factor === 1) return ingredients;
  return ingredients.map((ing) => ({
    ...ing,
    quantity: scaleQuantity(ing.quantity, factor),
    quantityMax: scaleQuantity(ing.quantityMax, factor),
  }));
}
