import type { Visibility } from "./shelves.js";

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
