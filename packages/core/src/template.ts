import type { Visibility } from "./shelves.js";
import { isUuid } from "./ids.js";
import { parseReviewedMeal } from "./reviewed-meal.js";
import type { MealSlot } from "./plan.js";

/**
 * A named, reusable meal — a main plus whichever side, drink, and dessert go
 * with it, the same grouping the full-meal nutrition total already uses.
 * Saving one is just giving that combination a name; sharing it is the same
 * link-and-visibility mechanism a single recipe already has.
 */

export const TEMPLATE_ROLES = ["main", "side", "drink", "dessert"] as const;
export type TemplateRole = (typeof TEMPLATE_ROLES)[number];

export const TEMPLATE_ROLE_LABEL: Record<TemplateRole, string> = {
  main: "Main",
  side: "Side",
  drink: "Drink",
  dessert: "Dessert",
};

export interface TemplateItem {
  role: TemplateRole;
  recipeId: string;
  title: string;
  imageUrl: string | null;
}

export interface MealTemplate {
  id: string;
  name: string;
  visibility: Visibility;
  items: TemplateItem[];
}

export interface MealTemplateCreateInput {
  /** Optional stable request identity for an identical retry. */
  id?: string;
  name: string;
  items: { role: TemplateRole; recipeId: string }[];
}

export interface MealTemplateRenameInput {
  /** Exact last-read name; never normalize the concurrency comparison. */
  previousName: string;
  name: string;
}

export function parseMealTemplateRename(value: unknown): MealTemplateRenameInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Review the saved meal name.");
  const input = value as Record<string, unknown>;
  // Historical names may be longer than today's creation limit. Bound the
  // request while allowing those meals to be renamed without recreating them.
  if (typeof input.previousName !== "string" || input.previousName.length > 1024 || /[\u0000-\u001f\u007f]/.test(input.previousName)) throw new Error("Reload the saved meal before renaming it.");
  if (typeof input.name !== "string" || input.name.length > 160 || !input.name.trim() || /[\u0000-\u001f\u007f]/.test(input.name)) throw new Error("Use a meal name between one and 160 characters.");
  return { previousName: input.previousName, name: input.name.trim() };
}

export function parseMealTemplateCreate(value: unknown): MealTemplateCreateInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Review a meal before saving.");
  const body = value as Record<string, unknown>;
  if (body.id !== undefined && !isUuid(body.id)) throw new Error("That meal request could not be identified.");
  if (typeof body.name !== "string" || body.name.length > 160 || /[\u0000-\u001f\u007f]/.test(body.name)) throw new Error("Use a meal name up to 160 characters.");
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > TEMPLATE_ROLES.length) throw new Error("Choose between one and four dishes.");
  const roles = new Set<TemplateRole>();
  const items = body.items.map(value => {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Choose a saved recipe for each dish.");
    const item = value as Record<string, unknown>;
    if (!TEMPLATE_ROLES.includes(item.role as TemplateRole) || !isUuid(item.recipeId)) throw new Error("Choose a known role and saved recipe for each dish.");
    const role = item.role as TemplateRole;
    if (roles.has(role)) throw new Error("Choose only one dish for each role.");
    roles.add(role);
    return { role, recipeId: item.recipeId.toLowerCase() };
  });
  return { id: typeof body.id === "string" ? body.id.toLowerCase() : undefined, name: body.name.trim() || "Untitled meal", items };
}

/** Copy only a reviewable name into a note, never quantities or nutrition. */
export function templateFoodNoteName(name: string): string | null {
  if (/[\u0000-\u001f\u007f]/.test(name)) return null;
  const title = name.trim().replace(/\s+/g, " ");
  return title.length > 0 && title.length <= 160 ? title : null;
}

export function orderedTemplateItems(items: readonly TemplateItem[]): TemplateItem[] {
  return [...items].sort((a, b) => TEMPLATE_ROLES.indexOf(a.role) - TEMPLATE_ROLES.indexOf(b.role) || a.recipeId.localeCompare(b.recipeId));
}

/** Local literal name/dish search over an already loaded owner snapshot. */
export function familiarMealMatches(meals: readonly MealTemplate[], query: string): MealTemplate[] {
  if (query.length > 100 || /[\u0000-\u001f\u007f]/.test(query)) return [];
  const needle = query.trim().toLowerCase();
  return meals.filter(meal => !needle || meal.name.toLowerCase().includes(needle) || meal.items.some(item => item.title.toLowerCase().includes(needle)));
}

export interface ReviewedTemplatePlanInput {
  templateId: string;
  /** Explicit distinct recipe snapshot; a changed combination requires review. */
  recipeIds: string[];
  date: string;
  slot: MealSlot;
}

export function parseReviewedTemplatePlan(value: unknown): ReviewedTemplatePlanInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Review a saved combination, date and meal slot.");
  const input = value as Record<string, unknown>;
  if (!isUuid(input.templateId) || !Array.isArray(input.recipeIds) || input.recipeIds.length < 1 || input.recipeIds.length > 4 || !input.recipeIds.every(isUuid)) throw new Error("Choose a saved combination with one to four distinct recipes.");
  const recipeIds = input.recipeIds.map(id => (id as string).toLowerCase()).sort();
  if (new Set(recipeIds).size !== recipeIds.length) throw new Error("Review each distinct recipe only once.");
  const reviewed = parseReviewedMeal({ recipeId: recipeIds[0], date: input.date, slot: input.slot });
  return { templateId: (input.templateId as string).toLowerCase(), recipeIds, date: reviewed.date, slot: reviewed.slot };
}

/** Confirm all reviewed fields; a partial/different receipt is still uncertain. */
export function reviewedTemplatePlanMatches(expected: ReviewedTemplatePlanInput, received: unknown): boolean {
  try {
    const a = parseReviewedTemplatePlan(expected); const b = parseReviewedTemplatePlan(received);
    return a.templateId === b.templateId && a.date === b.date && a.slot === b.slot && a.recipeIds.length === b.recipeIds.length && a.recipeIds.every((id, index) => id === b.recipeIds[index]);
  } catch { return false; }
}

/** What a stranger with the link sees — the recipes, not the owner's plan or shelves. */
export interface SharedTemplateView {
  id: string;
  name: string;
  items: TemplateItem[];
  sharedBy: { handle: string; displayName: string; avatarUrl: string | null };
  /** Whether the viewer may copy it into their own library — signed in, and not the owner. */
  canSave: boolean;
}

export const TEMPLATE_SHARE_PATH = "/t";

export const templateSharePath = (templateId: string): string => `${TEMPLATE_SHARE_PATH}/${templateId}`;

export function templateShareUrl(templateId: string, origin: string): string {
  return `${origin.replace(/\/$/, "")}${templateSharePath(templateId)}`;
}
