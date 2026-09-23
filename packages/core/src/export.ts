import { formatAmount, formatMinutes } from "./units.js";
import type { Ingredient, Recipe, Step } from "./recipe.js";

/**
 * Getting a recipe back out.
 *
 * A recipe collection you can't leave with isn't really yours. Everything here
 * turns the stored shape back into something that outlives the app: text to
 * paste into a message, Markdown to keep in a notes app, and a JSON archive of
 * the whole library.
 *
 * All of it is pure and lives in the shared package, so the same recipe reads
 * identically whether it left from the web, from the phone, or from a script.
 */

/**
 * Bumped when the archive shape changes in a way an importer would notice.
 *
 * Written into every export so a file found on a hard drive in three years can
 * still say what it is, rather than being guessed at by its keys.
 */
export const EXPORT_VERSION = 1;
export const SAVORTOME_ARCHIVE_FORMAT = "savortome-recipes" as const;
/** Historical archive marker. Keep this mapped so old exports remain identifiable. */
export const LEGACY_RECIPE_ARCHIVE_FORMAT = "second-breakfast-recipes" as const;

export interface RecipeArchive {
  format: typeof SAVORTOME_ARCHIVE_FORMAT;
  version: number;
  exportedAt: string;
  count: number;
  recipes: Recipe[];
}

export function buildArchive(recipes: readonly Recipe[], now: Date = new Date()): RecipeArchive {
  return {
    format: SAVORTOME_ARCHIVE_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    count: recipes.length,
    recipes: [...recipes],
  };
}

/**
 * A filename someone can find again.
 *
 * Strips everything a filesystem might object to rather than escaping it —
 * a title is decoration here, and `Grandma's "Best" Pie/Tart` becoming
 * `grandmas-best-pie-tart` loses nothing worth keeping.
 */
export function exportFilename(title: string, extension: string): string {
  const slug =
    title
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "recipe";
  return `${slug}.${extension}`;
}

/** "1 tbsp olive oil, finely chopped (optional)" — one line, everything in it. */
export function ingredientLine(ingredient: Ingredient): string {
  const amount = formatAmount(ingredient);
  const name = ingredient.item || ingredient.raw;
  const parts = [amount, name].filter(Boolean).join(" ");
  const notes = ingredient.notes ? `, ${ingredient.notes}` : "";
  const optional = ingredient.optional ? " (optional)" : "";
  return `${parts}${notes}${optional}`;
}

/**
 * Ingredients under their sub-recipe headings, in first-seen order.
 *
 * Order comes from the recipe rather than being sorted, because "For the
 * sauce" belongs where the cook was told about it — alphabetising the groups
 * of a recipe would be a small act of vandalism.
 */
export function groupIngredients(
  ingredients: readonly Ingredient[],
): { group: string | null; ingredients: Ingredient[] }[] {
  const groups: { group: string | null; ingredients: Ingredient[] }[] = [];
  for (const ingredient of ingredients) {
    const key = ingredient.group ?? null;
    const existing = groups.find((g) => g.group === key);
    if (existing) existing.ingredients.push(ingredient);
    else groups.push({ group: key, ingredients: [ingredient] });
  }
  return groups;
}

/** The line under the title: servings, times, however many of them are known. */
function factLine(recipe: Recipe): string {
  const facts = [
    recipe.servings ? `Serves ${recipe.servings}` : null,
    formatMinutes(recipe.prepMinutes) ? `Prep ${formatMinutes(recipe.prepMinutes)}` : null,
    formatMinutes(recipe.cookMinutes) ? `Cook ${formatMinutes(recipe.cookMinutes)}` : null,
    formatMinutes(recipe.totalMinutes) ? `Total ${formatMinutes(recipe.totalMinutes)}` : null,
  ].filter(Boolean);
  return facts.join(" · ");
}

/** Where it came from, credited. Empty for something typed by hand. */
function creditLine(recipe: Recipe): string {
  const who = recipe.source.author ?? recipe.source.siteName;
  if (recipe.source.url) return who ? `Source: ${who} — ${recipe.source.url}` : `Source: ${recipe.source.url}`;
  return who ? `Source: ${who}` : "";
}

export interface ExportOptions {
  /** Ingredients as scaled on screen, so a doubled recipe exports doubled. */
  ingredients?: readonly Ingredient[];
  servings?: number | null;
}

const stepLine = (step: Step, index: number): string => `${index + 1}. ${step.text}`;

/** A recipe as Markdown — for a notes app, a gist, or a pull request. */
export function recipeToMarkdown(recipe: Recipe, options: ExportOptions = {}): string {
  const ingredients = options.ingredients ?? recipe.ingredients;
  const shown = options.servings === undefined ? recipe : { ...recipe, servings: options.servings };

  const out: string[] = [`# ${recipe.title}`, ""];

  if (recipe.description) out.push(recipe.description, "");

  const facts = factLine(shown);
  if (facts) out.push(`*${facts}*`, "");

  out.push("## Ingredients", "");
  for (const group of groupIngredients(ingredients)) {
    if (group.group) out.push(`### ${group.group}`, "");
    for (const ingredient of group.ingredients) out.push(`- ${ingredientLine(ingredient)}`);
    out.push("");
  }

  if (recipe.steps.length > 0) {
    out.push("## Method", "");
    recipe.steps.forEach((step, i) => out.push(stepLine(step, i)));
    out.push("");
  }

  if (recipe.equipment.length > 0) {
    out.push("## Equipment", "", ...recipe.equipment.map((e) => `- ${e}`), "");
  }

  if (recipe.tags.length > 0) out.push(`Tags: ${recipe.tags.join(", ")}`, "");

  const credit = creditLine(recipe);
  if (credit) out.push("---", "", credit, "");

  return `${out.join("\n").trimEnd()}\n`;
}

/**
 * A recipe as plain text — for a message, an email, a text file.
 *
 * Deliberately not Markdown with the syntax stripped: somewhere that renders
 * nothing, `#` and `-` are just litter, so headings become underlines and the
 * ingredients become a plain list.
 */
export function recipeToText(recipe: Recipe, options: ExportOptions = {}): string {
  const ingredients = options.ingredients ?? recipe.ingredients;
  const shown = options.servings === undefined ? recipe : { ...recipe, servings: options.servings };

  const out: string[] = [recipe.title, "=".repeat(recipe.title.length), ""];

  if (recipe.description) out.push(recipe.description, "");

  const facts = factLine(shown);
  if (facts) out.push(facts, "");

  out.push("INGREDIENTS", "");
  for (const group of groupIngredients(ingredients)) {
    if (group.group) out.push(`${group.group}:`);
    for (const ingredient of group.ingredients) out.push(`  ${ingredientLine(ingredient)}`);
    out.push("");
  }

  if (recipe.steps.length > 0) {
    out.push("METHOD", "");
    recipe.steps.forEach((step, i) => out.push(stepLine(step, i)));
    out.push("");
  }

  if (recipe.equipment.length > 0) {
    out.push("EQUIPMENT", "", ...recipe.equipment.map((e) => `  ${e}`), "");
  }

  const credit = creditLine(recipe);
  if (credit) out.push(credit);

  return `${out.join("\n").trimEnd()}\n`;
}
