import type { Ingredient, RecipeDraft, Step } from "@seconds/core/format";

const nullableString = (value: unknown): value is string | null =>
  value === null || typeof value === "string";
const nullableNumber = (value: unknown): value is number | null =>
  value === null || (typeof value === "number" && Number.isFinite(value));

function isIngredient(value: unknown): value is Ingredient {
  if (!value || typeof value !== "object") return false;
  const ingredient = value as Partial<Ingredient>;
  return typeof ingredient.raw === "string"
    && nullableNumber(ingredient.quantity)
    && nullableNumber(ingredient.quantityMax)
    && nullableString(ingredient.unit)
    && typeof ingredient.item === "string"
    && typeof ingredient.canonicalItem === "string"
    && nullableString(ingredient.notes)
    && typeof ingredient.optional === "boolean"
    && nullableString(ingredient.group);
}

function isStep(value: unknown): value is Step {
  if (!value || typeof value !== "object") return false;
  const step = value as Partial<Step>;
  return typeof step.n === "number"
    && Number.isInteger(step.n)
    && typeof step.text === "string"
    && nullableNumber(step.timerSeconds)
    && (step.activeSeconds === undefined || nullableNumber(step.activeSeconds))
    && (step.demands === undefined
      || step.demands === null
      || ["knife", "stovetop", "oven", "timing"].includes(step.demands))
    && nullableNumber(step.sourceTimestamp);
}

/** Parse untrusted session storage without requiring an unfinished draft to be saveable yet. */
export function readRecipeDraftRecovery(raw: string | null): RecipeDraft | null {
  if (!raw) return null;
  try {
    const record = JSON.parse(raw) as { draft?: unknown };
    const value = record?.draft;
    if (!value || typeof value !== "object") return null;
    const draft = value as Partial<RecipeDraft>;
    if (typeof draft.title !== "string"
      || !nullableString(draft.description)
      || !nullableNumber(draft.servings)
      || !nullableString(draft.servingsNote)
      || !nullableNumber(draft.prepMinutes)
      || !nullableNumber(draft.cookMinutes)
      || !nullableNumber(draft.totalMinutes)
      || !Array.isArray(draft.ingredients)
      || !draft.ingredients.every(isIngredient)
      || !Array.isArray(draft.steps)
      || !draft.steps.every(isStep)
      || !Array.isArray(draft.equipment)
      || !draft.equipment.every((item) => typeof item === "string")
      || !Array.isArray(draft.tags)
      || !draft.tags.every((item) => typeof item === "string")
      || !nullableString(draft.cuisine)
      || !nullableString(draft.course)
      || !([null, "easy", "medium", "hard"] as unknown[]).includes(draft.difficulty)
      || !nullableString(draft.imageUrl)) return null;
    return draft as RecipeDraft;
  } catch {
    return null;
  }
}

export function recipeDraftStorageKey(storageScope: string, recipeId: string | null): string {
  return `savortome:recipe-draft:v1:${storageScope}:${recipeId ?? "new"}`;
}
