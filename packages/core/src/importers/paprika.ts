import { gunzipSync, inflateRawSync } from "node:zlib";
import { timerFromStep } from "../cook.js";
import type { ExtractedRecipe, Ingredient, Step } from "../recipe.js";
import { parseIngredientLine } from "../units.js";

/**
 * Reads a Paprika Recipe Manager export (`.paprikarecipes`) — a zip archive
 * of one gzip-compressed JSON blob per recipe — without any external
 * dependency. Paprika's own zip entries are always stored uncompressed (the
 * gzip layer does the compressing), but `inflateRawSync` is wired up too in
 * case a re-zipped or hand-edited export ever uses real deflate.
 */

export interface PaprikaImportItem {
  recipe: ExtractedRecipe;
  sourceUrl: string | null;
  author: string | null;
  imageUrl: string | null;
}

export interface PaprikaImportResult {
  items: PaprikaImportItem[];
  /** Entry names that looked like a recipe but couldn't be read as one. */
  skipped: string[];
}

// --- minimal zip reader --------------------------------------------------

interface ZipEntry {
  name: string;
  data: Buffer;
}

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;

function findEndOfCentralDirectory(buf: Buffer): number {
  // The record is fixed-size, but a variable-length comment can follow it,
  // so its offset has to be found by scanning back from the end.
  const minOffset = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= minOffset; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIGNATURE) return i;
  }
  throw new Error("not a zip archive (no end-of-central-directory record)");
}

function readLocalEntry(buf: Buffer, offset: number, method: number, compressedSize: number, name: string): Buffer {
  if (offset + 30 > buf.length || buf.readUInt32LE(offset) !== LOCAL_FILE_SIGNATURE) {
    throw new Error(`malformed local file header for ${name}`);
  }
  const nameLen = buf.readUInt16LE(offset + 26);
  const extraLen = buf.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + nameLen + extraLen;
  const compressed = buf.subarray(dataStart, dataStart + compressedSize);

  if (method === 0) return Buffer.from(compressed);
  if (method === 8) return inflateRawSync(compressed);
  throw new Error(`unsupported zip compression method ${method} for ${name}`);
}

function readZipEntries(buf: Buffer): ZipEntry[] {
  const eocd = findEndOfCentralDirectory(buf);
  const entryCount = buf.readUInt16LE(eocd + 10);
  let cursor = buf.readUInt32LE(eocd + 16);

  const entries: ZipEntry[] = [];
  for (let i = 0; i < entryCount; i++) {
    if (cursor + 46 > buf.length || buf.readUInt32LE(cursor) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error("malformed zip central directory");
    }
    const method = buf.readUInt16LE(cursor + 10);
    const compressedSize = buf.readUInt32LE(cursor + 20);
    const nameLen = buf.readUInt16LE(cursor + 28);
    const extraLen = buf.readUInt16LE(cursor + 30);
    const commentLen = buf.readUInt16LE(cursor + 32);
    const localHeaderOffset = buf.readUInt32LE(cursor + 42);
    const name = buf.toString("utf8", cursor + 46, cursor + 46 + nameLen);

    entries.push({ name, data: readLocalEntry(buf, localHeaderOffset, method, compressedSize, name) });
    cursor += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

// --- field parsing ---------------------------------------------------------

/** A blank line (or run of them) separates steps more reliably than a single newline does — Paprika sometimes wraps one step across a couple of lines. */
function parseSteps(text: string): Step[] {
  const paragraphs = text
    .split(/\r?\n\s*\r?\n/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const lines =
    paragraphs.length > 1
      ? paragraphs
      : text
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter(Boolean);
  return lines.map((line, i) => ({
    n: i + 1,
    text: line,
    timerSeconds: timerFromStep(line),
    sourceTimestamp: null,
  }));
}

/** A bare line ending in ":" with no digits reads as a group header ("For the sauce:"), same convention the recipe editor uses. */
function parseIngredientBlock(text: string): Ingredient[] {
  const ingredients: Ingredient[] = [];
  let group: string | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/:$/.test(line) && !/\d/.test(line)) {
      group = line.slice(0, -1).trim() || null;
      continue;
    }
    ingredients.push(parseIngredientLine(line, group));
  }
  return ingredients;
}

/** Paprika times are free text ("1 h 20 min", "45 min", "1.5 hours", or a bare number meaning minutes). */
function parseMinutes(v: unknown): number | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const s = v.toLowerCase();
  let total = 0;
  let matched = false;

  const hours = /(\d+(?:\.\d+)?)\s*(?:h\b|hr|hour)/.exec(s);
  if (hours) {
    total += Number(hours[1]) * 60;
    matched = true;
  }
  const minutes = /(\d+(?:\.\d+)?)\s*(?:m\b|min|minute)/.exec(s);
  if (minutes) {
    total += Number(minutes[1]);
    matched = true;
  }
  if (!matched) {
    const bare = /^(\d+(?:\.\d+)?)$/.exec(s.trim());
    if (bare) {
      total = Number(bare[1]);
      matched = true;
    }
  }
  return matched && total > 0 ? Math.round(total) : null;
}

function parseServings(v: unknown): { servings: number | null; servingsNote: string | null } {
  if (typeof v !== "string" || !v.trim()) return { servings: null, servingsNote: null };
  const note = v.trim();
  const leading = /^(\d+)/.exec(note);
  return { servings: leading ? Number(leading[1]) : null, servingsNote: note };
}

const DIFFICULTY_MAP: Record<string, "easy" | "medium" | "hard"> = {
  easy: "easy",
  simple: "easy",
  medium: "medium",
  moderate: "medium",
  intermediate: "medium",
  hard: "hard",
  difficult: "hard",
  advanced: "hard",
};

function parseDifficulty(v: unknown): "easy" | "medium" | "hard" | null {
  if (typeof v !== "string") return null;
  return DIFFICULTY_MAP[v.trim().toLowerCase()] ?? null;
}

function nonEmptyString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

interface RawPaprikaRecipe {
  name?: unknown;
  description?: unknown;
  notes?: unknown;
  ingredients?: unknown;
  directions?: unknown;
  prep_time?: unknown;
  cook_time?: unknown;
  total_time?: unknown;
  servings?: unknown;
  difficulty?: unknown;
  categories?: unknown;
  source?: unknown;
  source_url?: unknown;
  image_url?: unknown;
}

function toImportItem(json: RawPaprikaRecipe): PaprikaImportItem | null {
  const title = nonEmptyString(json.name);
  const ingredients = parseIngredientBlock(typeof json.ingredients === "string" ? json.ingredients : "");
  const steps = parseSteps(typeof json.directions === "string" ? json.directions : "");
  if (!title || ingredients.length === 0 || steps.length === 0) return null;

  const { servings, servingsNote } = parseServings(json.servings);
  const description =
    [nonEmptyString(json.description), nonEmptyString(json.notes)].filter(Boolean).join("\n\n") || null;

  const rawCategories = Array.isArray(json.categories)
    ? json.categories
    : typeof json.categories === "string"
      ? json.categories.split(",")
      : [];
  const tags = [
    ...new Set(rawCategories.map((c) => String(c).trim().toLowerCase()).filter(Boolean)),
  ].slice(0, 12);

  const prepMinutes = parseMinutes(json.prep_time);
  const cookMinutes = parseMinutes(json.cook_time);
  const totalMinutes =
    parseMinutes(json.total_time) ?? (prepMinutes != null && cookMinutes != null ? prepMinutes + cookMinutes : null);

  return {
    recipe: {
      title,
      description,
      servings,
      servingsNote,
      prepMinutes,
      cookMinutes,
      totalMinutes,
      ingredients,
      steps,
      equipment: [],
      tags,
      cuisine: null,
      course: null,
      difficulty: parseDifficulty(json.difficulty),
      // Read directly from fields the user already trusted enough to save in
      // another app — nothing here was inferred, so there's no confidence to
      // score below full marks the way a model extraction would be.
      confidence: 1,
      extractionNotes: [],
      ingredientNutritionGuesses: [],
    },
    sourceUrl: nonEmptyString(json.source_url),
    author: nonEmptyString(json.source),
    // Paprika's own export mostly carries photos as embedded base64 data
    // (`photo_data`), not a URL — that path isn't read here, so most
    // imported cards will simply have no image rather than a wrong one.
    imageUrl: nonEmptyString(json.image_url),
  };
}

/**
 * Parses a `.paprikarecipes` export into a list of recipes, deterministically
 * and without spending a model call — the export already carries every field
 * structured, the same reasoning that makes a page's own schema.org data free.
 */
export function parsePaprikaExport(buffer: Buffer): PaprikaImportResult {
  let entries: ZipEntry[];
  try {
    entries = readZipEntries(buffer);
  } catch (err) {
    throw new Error(
      `That doesn't look like a Paprika export (.paprikarecipes). ${err instanceof Error ? err.message : ""}`.trim(),
    );
  }

  const recipeEntries = entries.filter((e) => e.name.toLowerCase().endsWith(".paprikarecipe"));
  if (recipeEntries.length === 0) {
    throw new Error("That export didn't contain any recipes.");
  }

  const items: PaprikaImportItem[] = [];
  const skipped: string[] = [];
  for (const entry of recipeEntries) {
    try {
      const json = JSON.parse(gunzipSync(entry.data).toString("utf8")) as RawPaprikaRecipe;
      const item = toImportItem(json);
      if (item) items.push(item);
      else skipped.push(entry.name);
    } catch {
      skipped.push(entry.name);
    }
  }

  return { items, skipped };
}
