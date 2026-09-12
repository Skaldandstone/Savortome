import type { Ingredient, Step } from "./recipe.js";
import { ingredientsByStep } from "./step-ingredients.js";
import { formatAmount, parseQuantity } from "./units.js";

export interface StepActionCue {
  symbol: string;
  label: string;
}

const ACTION_CUES: readonly { pattern: RegExp; cue: StepActionCue }[] = [
  { pattern: /\b(?:preheat|prepare|line|grease|set aside)\b/i, cue: { symbol: "◇", label: "Prepare" } },
  { pattern: /\b(?:chop|dice|mince|slice|cut|julienne|zest|peel|trim)\b/i, cue: { symbol: "▱", label: "Cut and prepare" } },
  { pattern: /\b(?:whisk|stir|mix|fold|beat|cream|combine|toss|knead|blend)\b/i, cue: { symbol: "↻", label: "Mix and combine" } },
  { pattern: /\b(?:add|pour|sprinkle|scatter|place|transfer|drizzle)\b/i, cue: { symbol: "+", label: "Add ingredients" } },
  { pattern: /\b(?:bake|roast|broil|grill|fry|sear|boil|simmer|braise|blanch|poach|steam|cook)\b/i, cue: { symbol: "△", label: "Cook with heat" } },
  { pattern: /\b(?:rest|wait|cool|chill|freeze|refrigerate|proof|rise|set)\b/i, cue: { symbol: "◷", label: "Let it rest" } },
  { pattern: /\b(?:serve|plate|garnish|finish|enjoy)\b/i, cue: { symbol: "○", label: "Finish and serve" } },
];

/** A quiet visual summary of the main action in a cooking step. */
export function actionCueForStep(text: string): StepActionCue {
  return ACTION_CUES.find(({ pattern }) => pattern.test(text))?.cue
    ?? { symbol: "→", label: "Next action" };
}

export interface CookingTechnique {
  id: string;
  label: string;
  meaning: string;
  visualSteps: readonly [string, string, string];
  pattern: RegExp;
}

/**
 * Short, practical definitions that work offline in the kitchen.
 * These are technique instructions, not safety or doneness guarantees.
 */
const COOKING_TECHNIQUES: readonly CookingTechnique[] = [
  { id: "blanch", label: "Blanch", pattern: /\bblanch(?:e|ed|es|ing)?\b/i, meaning: "Boil briefly, then move the food straight into ice water to stop the cooking.", visualSteps: ["Brief boil", "Ice water", "Drain"] },
  { id: "braise", label: "Braise", pattern: /\bbrais(?:e|ed|es|ing)\b/i, meaning: "Brown the food first, then cook it slowly, covered, with a small amount of liquid.", visualSteps: ["Brown", "Add liquid", "Cover and simmer"] },
  { id: "bloom", label: "Bloom", pattern: /\bbloom(?:ed|s|ing)?\b/i, meaning: "Warm a spice or other aromatic ingredient briefly so its flavor opens before the next ingredients go in.", visualSteps: ["Warm fat", "Add spice", "Stir briefly"] },
  { id: "cream", label: "Cream", pattern: /\bcream(?:ed|s|ing)?\b/i, meaning: "Beat softened fat and sugar together until the mixture is lighter, smooth, and fluffy.", visualSteps: ["Soften", "Beat", "Light and fluffy"] },
  { id: "deglaze", label: "Deglaze", pattern: /\bdeglaz(?:e|ed|es|ing)\b/i, meaning: "Add liquid to a hot pan and scrape up the browned bits so they dissolve into the sauce.", visualSteps: ["Hot pan", "Add liquid", "Scrape fond"] },
  { id: "dredge", label: "Dredge", pattern: /\bdredg(?:e|ed|es|ing)\b/i, meaning: "Coat the food lightly in flour, crumbs, or another dry mixture before cooking.", visualSteps: ["Dry coating", "Turn food", "Shake excess"] },
  { id: "emulsify", label: "Emulsify", pattern: /\bemulsif(?:y|ied|ies|ying)\b/i, meaning: "Whisk two liquids that usually separate, such as oil and vinegar, until they hold together.", visualSteps: ["Start base", "Add slowly", "Whisk smooth"] },
  { id: "fold", label: "Fold", pattern: /\bfold(?:ed|s|ing)?\b/i, meaning: "Use a spatula to lift the mixture from underneath and turn it over gently, keeping as much air as possible.", visualSteps: ["Cut down", "Lift under", "Turn over"] },
  { id: "julienne", label: "Julienne", pattern: /\bjulienne(?:d|s|ing)?\b/i, meaning: "Cut the food into thin, even matchstick-shaped strips.", visualSteps: ["Square edges", "Thin slabs", "Matchsticks"] },
  { id: "knead", label: "Knead", pattern: /\bknead(?:ed|s|ing)?\b/i, meaning: "Press, fold, and turn dough repeatedly until it becomes smoother and more elastic.", visualSteps: ["Press", "Fold", "Turn"] },
  { id: "poach", label: "Poach", pattern: /\bpoach(?:ed|es|ing)?\b/i, meaning: "Cook gently in liquid kept below a full boil, with only a few small bubbles.", visualSteps: ["Heat liquid", "Gentle bubbles", "Cook softly"] },
  { id: "proof", label: "Proof", pattern: /\bproof(?:ed|s|ing)?\b/i, meaning: "Let yeast dough rest in a warm place until it rises to the size the recipe describes.", visualSteps: ["Cover dough", "Rest warm", "Check rise"] },
  { id: "reduce", label: "Reduce", pattern: /\breduc(?:e|ed|es|ing|tion)\b/i, meaning: "Simmer uncovered so water evaporates and the liquid becomes thicker and more concentrated.", visualSteps: ["Uncovered", "Gentle simmer", "Thickened"] },
  { id: "roux", label: "Roux", pattern: /\broux\b/i, meaning: "Cook flour in melted fat, stirring until the mixture is smooth and reaches the color the recipe describes.", visualSteps: ["Melt fat", "Stir flour", "Cook to color"] },
  { id: "sear", label: "Sear", pattern: /\bsear(?:ed|s|ing)?\b/i, meaning: "Cook the surface over fairly high heat until a browned crust forms, without cooking the center through yet.", visualSteps: ["Heat pan", "Place food", "Brown crust"] },
  { id: "simmer", label: "Simmer", pattern: /\bsimmer(?:ed|s|ing)?\b/i, meaning: "Keep the liquid just below a boil, with gentle bubbles rather than vigorous rolling bubbles.", visualSteps: ["Heat liquid", "Lower heat", "Gentle bubbles"] },
  { id: "temper", label: "Temper", pattern: /\btemper(?:ed|s|ing)?\b/i, meaning: "Slowly mix a little hot liquid into a cooler ingredient before combining everything, preventing curdling or seizing.", visualSteps: ["Cool mixture", "Add hot slowly", "Combine"] },
  { id: "zest", label: "Zest", pattern: /\bzest(?:ed|s|ing)?\b/i, meaning: "Remove only the thin colored outer peel of citrus, leaving the bitter white pith behind.", visualSteps: ["Colored peel", "Light strokes", "Leave pith"] },
];

export function techniquesForStep(text: string): CookingTechnique[] {
  return COOKING_TECHNIQUES.filter(({ pattern }) => pattern.test(text));
}

export interface StepIngredientAmount {
  ingredient: Ingredient;
  /** The amount to put above the instruction. */
  amount: string;
  /** Extra context when the recipe divides an ingredient across steps. */
  context: string | null;
  /** False when the source did not state enough to calculate this step's share. */
  exact: boolean;
}

const FRACTIONS: readonly [RegExp, number, string][] = [
  [/\b(?:one[- ]half|a half|half)(?:\s+of)?(?:\s+the)?\s*$/i, 1 / 2, "Half"],
  [/\b(?:three[- ]quarters?|3\s*\/\s*4|¾)(?:\s+of)?(?:\s+the)?\s*$/i, 3 / 4, "Three quarters"],
  [/\b(?:two[- ]thirds?|2\s*\/\s*3|⅔)(?:\s+of)?(?:\s+the)?\s*$/i, 2 / 3, "Two thirds"],
  [/\b(?:one[- ]third|a third|third|1\s*\/\s*3|⅓)(?:\s+of)?(?:\s+the)?\s*$/i, 1 / 3, "One third"],
  [/\b(?:one[- ]quarter|a quarter|quarter|1\s*\/\s*4|¼)(?:\s+of)?(?:\s+the)?\s*$/i, 1 / 4, "One quarter"],
];

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function referencesFor(ingredient: Ingredient, all: readonly Ingredient[]): string[] {
  const full = [ingredient.canonicalItem, ingredient.item]
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const words = full.flatMap((value) => value.split(/\s+/));
  const shorthand = words.at(-1);
  if (shorthand) {
    const owners = all.filter((candidate) =>
      [candidate.canonicalItem, candidate.item]
        .some((name) => name.toLowerCase().split(/\s+/).includes(shorthand)),
    );
    if (owners.length === 1) full.push(shorthand);
  }
  return [...new Set(full)].sort((a, b) => b.length - a.length);
}

function portionFor(text: string, ingredient: Ingredient, all: readonly Ingredient[]) {
  const references = referencesFor(ingredient, all);
  for (const reference of references) {
    const name = escapeRegExp(reference).replace(/\s+/g, "\\s+");
    const nearby = new RegExp(`(.{0,28})\\b${name}(?:es|s)?\\b`, "ig");
    for (const match of text.matchAll(nearby)) {
      const before = match[1] ?? "";
      if (/\b(?:remaining|remainder|rest of)(?:\s+the)?\s*$/i.test(before)) {
        return { kind: "remaining" as const };
      }
      for (const [pattern, fraction, label] of FRACTIONS) {
        if (pattern.test(before)) return { kind: "fraction" as const, fraction, label };
      }

      const quantity = /((?:\d+\s+)?\d+\s*\/\s*\d+|\d+(?:\.\d+)?|[¼½¾⅓⅔⅛⅜⅝⅞])\s*([a-z]+)?\s*$/i.exec(before);
      if (quantity) {
        const parsed = parseQuantity(quantity[1]!);
        const unit = quantity[2]?.toLowerCase() ?? null;
        const recipeUnit = ingredient.unit?.toLowerCase() ?? null;
        if (parsed && (!unit || !recipeUnit || unit === recipeUnit || unit === `${recipeUnit}s`)) {
          return { kind: "amount" as const, amount: parsed.value };
        }
      }
    }
  }
  return null;
}

function scaledAmount(ingredient: Ingredient, factor: number): string {
  return formatCookAmount({
    quantity: ingredient.quantity === null ? null : ingredient.quantity * factor,
    quantityMax: ingredient.quantityMax === null ? null : ingredient.quantityMax * factor,
    unit: ingredient.unit,
  });
}

const COOK_AMOUNT_PLURALS: Readonly<Record<string, string>> = {
  cup: "cups", pinch: "pinches", dash: "dashes", clove: "cloves",
  can: "cans", jar: "jars", package: "packages", bunch: "bunches",
  sprig: "sprigs", slice: "slices", stick: "sticks", head: "heads",
  stalk: "stalks", rib: "ribs", block: "blocks", bag: "bags",
  bottle: "bottles", tub: "tubs", loaf: "loaves", sheet: "sheets",
  ear: "ears", handful: "handfuls", quart: "quarts", pint: "pints",
  gallon: "gallons",
};

/** Natural unit labels in the large instruction card, while abbreviations stay unchanged. */
function formatCookAmount(
  ingredient: Pick<Ingredient, "quantity" | "unit"> & { quantityMax?: number | null },
): string {
  const formatted = formatAmount(ingredient);
  const unit = ingredient.unit;
  const largest = Math.max(ingredient.quantity ?? 0, ingredient.quantityMax ?? 0);
  const plural = unit ? COOK_AMOUNT_PLURALS[unit] : undefined;
  return plural && largest > 1
    ? formatted.replace(new RegExp(`${escapeRegExp(unit!)}$`), plural)
    : formatted;
}

/**
 * Amounts for every step, including honest handling of divided ingredients.
 * Exact text wins. A remaining amount is calculated only when every earlier
 * use had an exact numeric share; otherwise the recipe total stays visible.
 */
export function ingredientAmountsByStep(
  steps: readonly Step[],
  ingredients: readonly Ingredient[],
): Map<number, StepIngredientAmount[]> {
  const matched = ingredientsByStep(steps, ingredients);
  const useCount = new Map<Ingredient, number>();
  for (const list of matched.values()) {
    for (const ingredient of list) useCount.set(ingredient, (useCount.get(ingredient) ?? 0) + 1);
  }

  const allocated = new Map<Ingredient, number | null>();
  const result = new Map<number, StepIngredientAmount[]>();

  for (const step of steps) {
    const amounts: StepIngredientAmount[] = [];
    for (const ingredient of matched.get(step.n) ?? []) {
      const total = formatCookAmount(ingredient);
      const divided = /\bdivided\b/i.test(ingredient.notes ?? "") || (useCount.get(ingredient) ?? 0) > 1;
      const portion = portionFor(step.text, ingredient, ingredients);

      if (portion?.kind === "fraction" && ingredient.quantity !== null) {
        const amount = scaledAmount(ingredient, portion.fraction);
        amounts.push({ ingredient, amount, context: `${portion.label} of ${total} total`, exact: true });
        const prior = allocated.get(ingredient) ?? 0;
        allocated.set(ingredient, prior === null ? null : prior + ingredient.quantity * portion.fraction);
        continue;
      }

      if (portion?.kind === "amount") {
        amounts.push({ ingredient, amount: formatCookAmount({ quantity: portion.amount, unit: ingredient.unit }), context: total ? `From ${total} total` : null, exact: true });
        const prior = allocated.get(ingredient) ?? 0;
        allocated.set(ingredient, prior === null ? null : prior + portion.amount);
        continue;
      }

      if (portion?.kind === "remaining") {
        const prior = allocated.get(ingredient);
        if (ingredient.quantity !== null && ingredient.quantityMax === null && typeof prior === "number" && prior <= ingredient.quantity) {
          const remainder = ingredient.quantity - prior;
          amounts.push({ ingredient, amount: formatCookAmount({ quantity: remainder, unit: ingredient.unit }), context: `Remaining from ${total} total`, exact: true });
          allocated.set(ingredient, ingredient.quantity);
        } else {
          amounts.push({ ingredient, amount: "Remaining", context: total ? `From ${total} total` : "The recipe does not state the earlier share", exact: false });
          allocated.set(ingredient, null);
        }
        continue;
      }

      if (divided) {
        amounts.push({ ingredient, amount: total ? `${total} total` : "Amount not specified", context: "Divided; this step's share is not stated", exact: false });
        allocated.set(ingredient, null);
      } else {
        amounts.push({ ingredient, amount: total || "As needed", context: null, exact: ingredient.quantity !== null });
      }
    }
    result.set(step.n, amounts);
  }

  return result;
}

/** Horizontal, deliberate swipes only. Left advances; right goes back. */
export function stepSwipeDelta(
  start: { x: number; y: number },
  end: { x: number; y: number },
  threshold = 64,
): -1 | 0 | 1 {
  const x = end.x - start.x;
  const y = end.y - start.y;
  if (Math.abs(x) < threshold || Math.abs(x) < Math.abs(y) * 1.25) return 0;
  return x < 0 ? 1 : -1;
}
