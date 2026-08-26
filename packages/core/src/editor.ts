import type { Ingredient, Step } from "./recipe.js";
import { timerFromStep } from "./cook.js";
import { canonicalize, parseIngredientLine } from "./units.js";

/**
 * Writing and correcting recipes by hand.
 *
 * Two jobs, one shape: typing a recipe from scratch, and fixing what the
 * extractor got wrong. The second is the one that matters most — every
 * imported card carries a list of what had to be inferred, and until now there
 * was no way to act on it.
 */

export interface RecipeDraft {
  title: string;
  description: string | null;
  servings: number | null;
  servingsNote: string | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  totalMinutes: number | null;
  ingredients: Ingredient[];
  steps: Step[];
  equipment: string[];
  tags: string[];
  cuisine: string | null;
  course: string | null;
  difficulty: "easy" | "medium" | "hard" | null;
  imageUrl: string | null;
}

export class RecipeValidationError extends Error {
  constructor(
    message: string,
    /** Which field to point the cursor at. */
    readonly field?: string,
  ) {
    super(message);
    this.name = "RecipeValidationError";
  }
}

export const MAX_TITLE = 200;
export const MAX_STEPS = 100;
export const MAX_INGREDIENTS = 100;

/** A blank recipe to start typing into. */
export function emptyDraft(): RecipeDraft {
  return {
    title: "",
    description: null,
    servings: null,
    servingsNote: null,
    prepMinutes: null,
    cookMinutes: null,
    totalMinutes: null,
    ingredients: [blankIngredient()],
    steps: [blankStep(1)],
    equipment: [],
    tags: [],
    cuisine: null,
    course: null,
    difficulty: null,
    imageUrl: null,
  };
}

export function blankIngredient(): Ingredient {
  return {
    raw: "",
    quantity: null,
    quantityMax: null,
    unit: null,
    item: "",
    canonicalItem: "",
    notes: null,
    optional: false,
    group: null,
  };
}

export const blankStep = (n: number): Step => ({
  n,
  text: "",
  timerSeconds: null,
  sourceTimestamp: null,
});

/**
 * Turn a whole typed line into a structured ingredient.
 *
 * People type "2 tbsp olive oil", not three separate fields, so the editor
 * offers one box per ingredient and splits it with the same parser the
 * importer uses. That keeps hand-written recipes on the same canonical names
 * as imported ones, which is what pantry search and shopping lists join on.
 */
export function ingredientFromLine(line: string, group: string | null = null): Ingredient {
  const trimmed = line.trim();
  if (!trimmed) return { ...blankIngredient(), group };
  // "For the sauce:" is how people write a section heading, so that's how one
  // is typed — no separate control, and the same box as everything else.
  if (trimmed.endsWith(":")) return groupHeading(trimmed.slice(0, -1));
  return parseIngredientLine(trimmed, group);
}

/**
 * A section heading, as a row in the ingredient list.
 *
 * Sub-recipes ("For the sauce", "For the topping") are stored on each
 * ingredient, but nobody wants to type the same heading onto six rows. So the
 * editor keeps headings as rows of their own and folds them back onto the
 * ingredients underneath when the draft is normalised.
 */
export function groupHeading(name: string): Ingredient {
  const trimmed = name.trim();
  return {
    ...blankIngredient(),
    raw: `${trimmed}:`,
    group: trimmed || null,
  };
}

/** A row that names a section rather than a thing to buy. */
export const isGroupHeading = (ing: Ingredient): boolean =>
  ing.item.trim() === "" && ing.raw.trim().endsWith(":");

/** Re-derive everything that's computed from what the person typed. */
export function normalizeDraft(draft: RecipeDraft): RecipeDraft {
  // Headings apply to everything below them until the next one, which is how
  // recipes are written and read. A heading with nothing under it is dropped
  // along with the other empty rows.
  const ingredients: Ingredient[] = [];
  let currentGroup: string | null = null;

  for (const ing of draft.ingredients) {
    if (isGroupHeading(ing)) {
      currentGroup = ing.group?.trim() || ing.raw.trim().replace(/:$/, "") || null;
      continue;
    }
    if (!(ing.item || ing.raw).trim()) continue;

    ingredients.push({
      ...ing,
      item: ing.item.trim(),
      raw: ing.raw.trim() || ing.item.trim(),
      notes: ing.notes?.trim() || null,
      group: currentGroup,
      // Always recomputed: an edited name with a stale key is worse than no
      // key at all, because the recipe silently stops matching.
      canonicalItem: canonicalize(ing.item || ing.raw),
    });
  }

  const steps = draft.steps
    .filter((step) => step.text.trim().length > 0)
    .map((step, i) => ({
      ...step,
      n: i + 1,
      text: step.text.trim(),
      // A step that states a duration gets a timer from it, so writing
      // "simmer for 20 minutes" is all anyone has to do. When the text says
      // nothing, whatever was already there stands — a video's timer often
      // comes from what was shown rather than what was said.
      timerSeconds: timerFromStep(step.text) ?? step.timerSeconds,
    }));

  const prep = draft.prepMinutes;
  const cook = draft.cookMinutes;

  return {
    ...draft,
    title: draft.title.trim(),
    description: draft.description?.trim() || null,
    servingsNote: draft.servingsNote?.trim() || null,
    cuisine: draft.cuisine?.trim() || null,
    course: draft.course?.trim().toLowerCase() || null,
    imageUrl: draft.imageUrl?.trim() || null,
    equipment: draft.equipment.map((e) => e.trim()).filter(Boolean),
    tags: [
      ...new Set(draft.tags.map((t) => t.trim().toLowerCase().replace(/^#/, "")).filter(Boolean)),
    ],
    ingredients,
    steps,
    // A total the cook didn't give is better derived than left blank, but never
    // overwrites one they did.
    totalMinutes:
      draft.totalMinutes ?? (prep !== null && cook !== null ? prep + cook : null),
  };
}

/** Everything that has to be true before this can be saved. */
export function validateDraft(draft: RecipeDraft): void {
  if (!draft.title.trim()) {
    throw new RecipeValidationError("Give the recipe a name.", "title");
  }
  if (draft.title.length > MAX_TITLE) {
    throw new RecipeValidationError(`That name is longer than ${MAX_TITLE} characters.`, "title");
  }

  const ingredients = draft.ingredients.filter(
    (i) => !isGroupHeading(i) && (i.item || i.raw).trim(),
  );
  if (ingredients.length === 0) {
    throw new RecipeValidationError("A recipe needs at least one ingredient.", "ingredients");
  }
  if (ingredients.length > MAX_INGREDIENTS) {
    throw new RecipeValidationError(
      `That's more than ${MAX_INGREDIENTS} ingredients — is something wrong?`,
      "ingredients",
    );
  }

  const steps = draft.steps.filter((s) => s.text.trim());
  if (steps.length === 0) {
    throw new RecipeValidationError("A recipe needs at least one step.", "steps");
  }
  if (steps.length > MAX_STEPS) {
    throw new RecipeValidationError(`That's more than ${MAX_STEPS} steps.`, "steps");
  }

  for (const field of ["servings", "prepMinutes", "cookMinutes", "totalMinutes"] as const) {
    const value = draft[field];
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      throw new RecipeValidationError("Times and servings can't be negative.", field);
    }
  }
}

/**
 * Seed the form from a recipe that already exists.
 *
 * Takes the draft shape rather than a whole `Recipe` and copies field by field,
 * so nothing the form doesn't own — the id, the provenance, who it belongs to —
 * can ride along into the body of a save.
 */
export function draftFromRecipe(recipe: RecipeDraft): RecipeDraft {
  return {
    title: recipe.title,
    description: recipe.description,
    servings: recipe.servings,
    servingsNote: recipe.servingsNote,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    totalMinutes: recipe.totalMinutes,
    // A recipe saved with no ingredients or steps can't be edited into shape if
    // the form gives you nothing to type into.
    ingredients: recipe.ingredients.length > 0 ? withHeadingRows(recipe.ingredients) : [blankIngredient()],
    steps: recipe.steps.length > 0 ? [...recipe.steps] : [blankStep(1)],
    equipment: [...recipe.equipment],
    tags: [...recipe.tags],
    cuisine: recipe.cuisine,
    course: recipe.course,
    difficulty: recipe.difficulty,
    imageUrl: recipe.imageUrl,
  };
}

/**
 * Put a heading row above each run of ingredients that shares a group.
 *
 * Assumes headings partition the list from where they appear, which is how
 * every recipe writes them. A list that went grouped -> ungrouped again can't
 * be expressed this way, and the ungrouped tail would be absorbed into the
 * group above it on the next save.
 */
function withHeadingRows(ingredients: Ingredient[]): Ingredient[] {
  const rows: Ingredient[] = [];
  let lastGroup: string | null = null;

  for (const ing of ingredients) {
    if (ing.group && ing.group !== lastGroup) rows.push(groupHeading(ing.group));
    lastGroup = ing.group;
    rows.push(ing);
  }
  return rows;
}

/** Move an item within a list, for reordering steps and ingredients. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items;
  }
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved as T);
  return next;
}

/**
 * Has a person confirmed this card is right?
 *
 * An imported recipe carries a confidence score and a list of guesses. Once
 * someone has actually read it through, that history stays on the record but
 * stops being a warning — which is the difference between "we're not sure" and
 * "we weren't sure, and then someone checked".
 */
export const isVerified = (verifiedAt: string | null): boolean => verifiedAt !== null;

export function provenanceTone(
  confidence: number,
  extractionNoteCount: number,
  verifiedAt: string | null,
): "verified" | "needs-review" | "fine" {
  if (isVerified(verifiedAt)) return "verified";
  return confidence < 0.8 || extractionNoteCount > 0 ? "needs-review" : "fine";
}
