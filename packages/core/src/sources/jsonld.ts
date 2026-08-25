import * as cheerio from "cheerio";
import { decodeHTML } from "entities";
import { timerFromStep } from "../cook.js";
import type { ExtractedRecipe, Ingredient, Step } from "../recipe.js";
import { parseIngredientLine } from "../units.js";

/** ISO-8601 duration ("PT1H15M") -> minutes. */
export function isoDurationToMinutes(v: unknown): number | null {
  if (typeof v === "number") return Math.round(v);
  if (typeof v !== "string") return null;
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/.exec(v.trim());
  if (!m) {
    const plain = /^(\d+)\s*(min|minute|hour|hr)/i.exec(v.trim());
    if (plain) {
      const n = Number(plain[1]);
      return /h/i.test(plain[2] as string) ? n * 60 : n;
    }
    return null;
  }
  const [, d, h, min, s] = m;
  const total =
    Number(d ?? 0) * 1440 + Number(h ?? 0) * 60 + Number(min ?? 0) + Number(s ?? 0) / 60;
  return total > 0 ? Math.round(total) : null;
}

const asArray = <T>(v: T | T[] | undefined | null): T[] =>
  v == null ? [] : Array.isArray(v) ? v : [v];

// JSON-LD payloads routinely carry HTML-escaped text ("&frac12; cup"), which
// would otherwise defeat quantity parsing entirely.
const textOf = (v: unknown): string | null => {
  if (typeof v === "string") return decodeHTML(v).trim() || null;
  if (Array.isArray(v)) return v.map(textOf).filter(Boolean).join(" ").trim() || null;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return textOf(o.text ?? o.name ?? o["@value"] ?? null);
  }
  return null;
};

const isRecipeNode = (n: unknown): n is Record<string, unknown> => {
  if (!n || typeof n !== "object") return false;
  const t = (n as Record<string, unknown>)["@type"];
  return asArray(t as string | string[]).some((x) => String(x).toLowerCase() === "recipe");
};

/** Depth-first walk of a JSON-LD blob, since sites nest recipes under @graph, arrays, or mainEntity. */
function findRecipeNode(node: unknown, depth = 0): Record<string, unknown> | null {
  if (depth > 6 || node == null) return null;
  if (isRecipeNode(node)) return node;
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findRecipeNode(child, depth + 1);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof node === "object") {
    for (const child of Object.values(node as Record<string, unknown>)) {
      const hit = findRecipeNode(child, depth + 1);
      if (hit) return hit;
    }
  }
  return null;
}

/** Instructions come as strings, HowToStep objects, or HowToSection groups. Flatten all three. */
function flattenInstructions(v: unknown, out: string[] = []): string[] {
  for (const node of asArray(v as unknown[])) {
    if (typeof node === "string") {
      // Some sites dump the whole method into one string with embedded markup.
      const stripped = cheerio.load(`<div>${node}</div>`)("div").text();
      for (const piece of stripped.split(/\r?\n|(?<=\.)\s{2,}/)) {
        const t = piece.trim();
        if (t) out.push(t);
      }
      continue;
    }
    if (node && typeof node === "object") {
      const o = node as Record<string, unknown>;
      const type = asArray(o["@type"] as string | string[]).map(String).join(",").toLowerCase();
      if (type.includes("howtosection")) {
        flattenInstructions(o.itemListElement, out);
        continue;
      }
      const t = textOf(o.text ?? o.name);
      if (t) out.push(t);
    }
  }
  return out;
}

/**
 * "4", "6 servings", and "serves 4-6" are serving counts. "1 loaf" and
 * "24 cookies" are not — treating a loaf as one serving makes the scaler say
 * "1 serving", so those keep their wording and leave `servings` unset.
 */
function isPerServingYield(raw: string | null): boolean {
  if (!raw) return false;
  const stripped = raw
    .replace(/serv(?:es|ings?)|portions?|people|about|approx(?:imately)?/gi, " ")
    .replace(/[\s]+/g, " ")
    .trim();
  return /^\d+(?:\s*(?:-|–|—|to)\s*\d+)?$/.test(stripped);
}

export interface JsonLdResult {
  recipe: ExtractedRecipe;
  imageUrl: string | null;
  author: string | null;
  /** Fraction of ingredient lines we split into a quantity or unit. Low means fall back to the model. */
  parseCoverage: number;
}

/**
 * Read a schema.org/Recipe out of a page's JSON-LD. Most food blogs publish one
 * (their recipe-card plugins emit it), which lets us skip the model entirely.
 */
export function extractJsonLdRecipe(html: string): JsonLdResult | null {
  const $ = cheerio.load(html);
  let node: Record<string, unknown> | null = null;

  for (const el of $('script[type="application/ld+json"]').toArray()) {
    const raw = $(el).text();
    if (!raw.trim()) continue;
    try {
      node = findRecipeNode(JSON.parse(raw));
    } catch {
      continue; // malformed blocks are common; just try the next one
    }
    if (node) break;
  }
  if (!node) return null;

  const title = textOf(node.name);
  const ingredientLines = asArray(node.recipeIngredient ?? node.ingredients)
    .map(textOf)
    .filter((s): s is string => Boolean(s));
  const instructionLines = flattenInstructions(node.recipeInstructions);
  if (!title || ingredientLines.length === 0 || instructionLines.length === 0) return null;

  const ingredients: Ingredient[] = ingredientLines.map((l) => parseIngredientLine(l));
  const steps: Step[] = instructionLines.map((text, i) => ({
    n: i + 1,
    text,
    timerSeconds: timerFromStep(text),
    sourceTimestamp: null,
  }));

  // recipeYield is often an array like ["1", "1 loaf"] — joining it yields
  // "1 1 loaf", so take the most descriptive entry instead.
  const yieldRaw = asArray(node.recipeYield as unknown)
    .map(textOf)
    .filter((s): s is string => Boolean(s))
    .sort((a, b) => b.length - a.length)[0] ?? null;
  // "4" and "serves 4" are serving counts; "1 loaf" and "24 cookies" are not.
  // Treating a loaf as one serving makes the scaler say "1 serving", so only
  // fill `servings` when the yield really is per-person.
  const servingsMatch = isPerServingYield(yieldRaw) ? /(\d+)/.exec(yieldRaw as string) : null;

  const image = asArray(node.image as unknown)
    .map((im) =>
      typeof im === "string" ? im : ((im as Record<string, unknown>)?.url as string | undefined),
    )
    .find((u): u is string => typeof u === "string" && u.startsWith("http")) ?? null;

  const prep = isoDurationToMinutes(node.prepTime);
  const cook = isoDurationToMinutes(node.cookTime);
  const total = isoDurationToMinutes(node.totalTime) ?? (prep != null && cook != null ? prep + cook : null);

  const tags = [
    ...asArray(node.recipeCategory as string | string[]).map(textOf),
    ...asArray(node.keywords as string | string[]).flatMap((k) =>
      typeof k === "string" ? k.split(",") : [textOf(k)],
    ),
  ]
    .map((t) => (t ?? "").trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 12);

  const parsed = ingredients.filter((i) => i.quantity !== null || i.unit !== null).length;

  return {
    recipe: {
      title,
      description: textOf(node.description),
      servings: servingsMatch ? Number(servingsMatch[1]) : null,
      servingsNote: yieldRaw,
      prepMinutes: prep,
      cookMinutes: cook,
      totalMinutes: total,
      ingredients,
      steps,
      equipment: [],
      tags: [...new Set(tags)],
      cuisine: textOf(node.recipeCuisine),
      course: textOf(asArray(node.recipeCategory as string | string[])[0]) ?? null,
      difficulty: null,
      confidence: 0.95,
      extractionNotes: [],
    },
    imageUrl: image,
    author: textOf(node.author),
    parseCoverage: ingredients.length ? parsed / ingredients.length : 0,
  };
}
