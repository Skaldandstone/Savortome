import type { PantryEntry, PantryStorageLocation } from "./pantry.js";
import { canonicalize } from "./units.js";

export interface FoodStorageGuide {
  id: string;
  names: readonly string[];
  defaultStorage: PantryStorageLocation;
  storageAdvice: string;
  separationAdvice?: string;
  /** A gentle quality check, never a discard or safety date. */
  checkAfterDays?: number;
  recipeQuery?: string;
  sourceLabel: string;
  sourceUrl: string;
}

export interface PantryAttention {
  guide: FoodStorageGuide;
  daysSinceKnown: number | null;
  shouldResurface: boolean;
  message: string;
}

const USDA_PRODUCE = "https://www.fns.usda.gov/fs/produce-safety/storage";
const FDA_PRODUCE = "https://www.fda.gov/food/buy-store-serve-safe-food/selecting-and-serving-produce-safely";

/**
 * Small, reviewed guidance set. Check thresholds are product reminders for
 * quality and memory support. They are deliberately not expiry dates.
 */
export const FOOD_STORAGE_GUIDES: readonly FoodStorageGuide[] = [
  {
    id: "banana",
    names: ["banana", "plantain"],
    defaultStorage: "countertop",
    storageAdvice: "Keep whole bananas at room temperature and check their ripeness often.",
    separationAdvice: "Bananas release ethylene as they ripen. Keep them apart from produce that is sensitive to faster ripening when practical.",
    checkAfterDays: 3,
    recipeQuery: "banana",
    sourceLabel: "USDA produce storage guidance",
    sourceUrl: USDA_PRODUCE,
  },
  {
    id: "tomato",
    names: ["tomato", "cherry tomato"],
    defaultStorage: "countertop",
    storageAdvice: "Keep whole, uncut tomatoes at room temperature unless their package says otherwise. Refrigerate cut or packaged pre-cut tomatoes.",
    checkAfterDays: 4,
    recipeQuery: "tomato",
    sourceLabel: "FDA produce safety guidance",
    sourceUrl: FDA_PRODUCE,
  },
  {
    id: "berries",
    names: ["strawberry", "blueberry", "raspberry", "blackberry", "berry"],
    defaultStorage: "refrigerator",
    storageAdvice: "Refrigerate perishable berries at 40°F (4°C) or below and follow package directions.",
    checkAfterDays: 2,
    recipeQuery: "berries",
    sourceLabel: "FDA produce safety guidance",
    sourceUrl: FDA_PRODUCE,
  },
  {
    id: "leafy-greens",
    names: ["lettuce", "spinach", "kale", "salad green", "leafy green"],
    defaultStorage: "refrigerator",
    storageAdvice: "Refrigerate perishable leafy greens at 40°F (4°C) or below. Always refrigerate packaged or pre-cut produce.",
    checkAfterDays: 3,
    recipeQuery: "greens",
    sourceLabel: "FDA produce safety guidance",
    sourceUrl: FDA_PRODUCE,
  },
  {
    id: "potatoes",
    names: ["potato", "sweet potato"],
    defaultStorage: "pantry",
    storageAdvice: "Keep potatoes in dry storage around 60°F to 70°F (16°C to 21°C), away from temperature extremes.",
    sourceLabel: "USDA produce storage guidance",
    sourceUrl: USDA_PRODUCE,
  },
  {
    id: "dry-onions",
    names: ["onion", "yellow onion", "red onion", "white onion", "dry onion"],
    defaultStorage: "pantry",
    storageAdvice: "Keep dry onions in dry storage around 60°F to 70°F (16°C to 21°C), away from temperature extremes.",
    sourceLabel: "USDA produce storage guidance",
    sourceUrl: USDA_PRODUCE,
  },
];

const GUIDE_BY_NAME = new Map(
  FOOD_STORAGE_GUIDES.flatMap(guide => guide.names.map(name => [canonicalize(name), guide] as const)),
);

export function storageGuideFor(canonicalItem: string): FoodStorageGuide | null {
  return GUIDE_BY_NAME.get(canonicalize(canonicalItem)) ?? null;
}

export function pantryAttention(
  entry: Pick<PantryEntry, "canonicalItem" | "displayName" | "acquiredAt" | "lastConfirmedAt" | "resurfaceAfter" | "resurfaceHidden" | "updatedAt">,
  now: Date = new Date(),
): PantryAttention | null {
  const guide = storageGuideFor(entry.canonicalItem);
  if (!guide) return null;

  const knownAt = newestValidDate(entry.lastConfirmedAt, entry.acquiredAt, entry.updatedAt);
  const daysSinceKnown = knownAt === null ? null : Math.max(0, Math.floor((now.getTime() - knownAt) / 86_400_000));
  const snoozedUntil = entry.resurfaceAfter ? Date.parse(entry.resurfaceAfter) : Number.NaN;
  const promptAllowed = !entry.resurfaceHidden && (!Number.isFinite(snoozedUntil) || snoozedUntil <= now.getTime());
  const shouldResurface = promptAllowed && guide.checkAfterDays !== undefined && daysSinceKnown !== null && daysSinceKnown >= guide.checkAfterDays;
  const name = entry.displayName || entry.canonicalItem;

  return {
    guide,
    daysSinceKnown,
    shouldResurface,
    message: shouldResurface
      ? `Still have ${name}? It has been about ${daysSinceKnown} day${daysSinceKnown === 1 ? "" : "s"} since it was last confirmed. Check it before planning around it.`
      : `Storage guidance for ${name}.`,
  };
}

function newestValidDate(...values: Array<string | null | undefined>): number | null {
  const times = values
    .map(value => value ? Date.parse(value) : Number.NaN)
    .filter(Number.isFinite);
  return times.length > 0 ? Math.max(...times) : null;
}
