import type { Ingredient } from "./recipe.js";

/** Vulgar fractions show up constantly in scraped blog markup. */
const VULGAR: Record<string, number> = {
  "¼": 0.25, "½": 0.5, "¾": 0.75, "⅐": 1 / 7, "⅑": 1 / 9, "⅒": 0.1,
  "⅓": 1 / 3, "⅔": 2 / 3, "⅕": 0.2, "⅖": 0.4, "⅗": 0.6, "⅘": 0.8,
  "⅙": 1 / 6, "⅚": 5 / 6, "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
};

const WORD_NUMBERS: Record<string, number> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  half: 0.5, quarter: 0.25, dozen: 12,
};

/** Canonical unit -> every spelling we expect to see or hear. */
const UNIT_ALIASES: Record<string, string[]> = {
  tsp: ["tsp", "tsps", "teaspoon", "teaspoons", "t"],
  tbsp: ["tbsp", "tbsps", "tbs", "tablespoon", "tablespoons", "T"],
  cup: ["cup", "cups", "c"],
  floz: ["fl oz", "floz", "fluid ounce", "fluid ounces"],
  oz: ["oz", "ozs", "ounce", "ounces"],
  lb: ["lb", "lbs", "pound", "pounds"],
  g: ["g", "gr", "gram", "grams"],
  kg: ["kg", "kgs", "kilogram", "kilograms"],
  ml: ["ml", "milliliter", "milliliters", "millilitre", "millilitres"],
  l: ["l", "liter", "liters", "litre", "litres"],
  pinch: ["pinch", "pinches"],
  dash: ["dash", "dashes"],
  clove: ["clove", "cloves"],
  can: ["can", "cans"],
  jar: ["jar", "jars"],
  package: ["package", "packages", "pkg", "pkgs", "packet", "packets"],
  bunch: ["bunch", "bunches"],
  sprig: ["sprig", "sprigs"],
  slice: ["slice", "slices"],
  stick: ["stick", "sticks"],
  head: ["head", "heads"],
  stalk: ["stalk", "stalks"],
  rib: ["rib", "ribs"],
  // Things sold as one object. Without these the container word ends up in the
  // ingredient's name — "block firm tofu" never matches "firm tofu" in a pantry.
  block: ["block", "blocks"],
  bag: ["bag", "bags"],
  bottle: ["bottle", "bottles"],
  tub: ["tub", "tubs", "container", "containers"],
  loaf: ["loaf", "loaves"],
  sheet: ["sheet", "sheets"],
  ear: ["ear", "ears"],
  handful: ["handful", "handfuls"],
  quart: ["quart", "quarts", "qt"],
  pint: ["pint", "pints", "pt"],
  gallon: ["gallon", "gallons", "gal"],
};

const UNIT_LOOKUP = new Map<string, string>();
for (const [canonical, aliases] of Object.entries(UNIT_ALIASES)) {
  for (const a of aliases) UNIT_LOOKUP.set(a.toLowerCase(), canonical);
}

export const normalizeUnit = (raw: string | null): string | null =>
  raw ? (UNIT_LOOKUP.get(raw.trim().toLowerCase().replace(/\.$/, "")) ?? raw.trim().toLowerCase()) : null;

/** "1 1/2", "1½", "½", "1.5", "one" -> 1.5 etc. Returns null when nothing numeric leads. */
export function parseQuantity(input: string): { value: number; rest: string } | null {
  let s = input.trim();

  // Split a leading vulgar fraction off a whole number: "1½" -> "1 ½"
  s = s.replace(/(\d)([¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/g, "$1 $2");

  const mixed = /^(\d+)\s+(\d+)\s*\/\s*(\d+)\b/.exec(s);
  if (mixed) {
    const [, w, n, d] = mixed as unknown as [string, string, string, string];
    return { value: Number(w) + Number(n) / Number(d), rest: s.slice(mixed[0].length) };
  }

  const wholeVulgar = /^(\d+)\s+([¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/.exec(s);
  if (wholeVulgar) {
    const [, w, v] = wholeVulgar as unknown as [string, string, string];
    return { value: Number(w) + (VULGAR[v] ?? 0), rest: s.slice(wholeVulgar[0].length) };
  }

  const frac = /^(\d+)\s*\/\s*(\d+)\b/.exec(s);
  if (frac) {
    const [, n, d] = frac as unknown as [string, string, string];
    return { value: Number(n) / Number(d), rest: s.slice(frac[0].length) };
  }

  const vulgar = /^([¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/.exec(s);
  if (vulgar) {
    const v = vulgar[1] as string;
    return { value: VULGAR[v] ?? 0, rest: s.slice(vulgar[0].length) };
  }

  const dec = /^(\d+(?:\.\d+)?)/.exec(s);
  if (dec) return { value: Number(dec[1]), rest: s.slice(dec[0].length) };

  const word = /^([a-z]+)\b/i.exec(s);
  if (word) {
    const w = (word[1] as string).toLowerCase();
    if (w in WORD_NUMBERS) return { value: WORD_NUMBERS[w] as number, rest: s.slice(word[0].length) };
  }
  return null;
}

const PREP_WORDS = [
  "chopped", "finely chopped", "roughly chopped", "diced", "minced", "sliced",
  "thinly sliced", "grated", "shredded", "melted", "softened", "room temperature",
  "packed", "divided", "drained", "rinsed", "peeled", "seeded", "crushed",
  "beaten", "cubed", "julienned", "toasted", "halved", "quartered", "trimmed",
  "mashed", "whisked", "blended", "pureed", "zested", "juiced", "torn", "shaved",
  "warmed", "chilled", "frozen", "thawed", "cut into pieces", "at room temperature",
];

/**
 * Adjectives and filler that describe an ingredient without identifying it.
 * Removing them is what makes "3 very ripe bananas" and "banana" the same key.
 */
const QUALIFIER_WORDS = [
  "fresh", "freshly", "large", "small", "medium", "ripe", "very", "extra", "virgin",
  "whole", "ground", "raw", "cooked", "uncooked", "boneless", "skinless", "unsalted",
  "salted", "about", "roughly", "approximately", "good", "high", "best", "quality",
  "preferably",
];

const QUALIFIER_PATTERN = new RegExp(
  String.raw`\b(${QUALIFIER_WORDS.join("|")}|low[- ]fat|non[- ]fat|plus more.*)\b`,
  "g",
);

/** Every single word that describes rather than identifies, for the hyphen pass. */
const MODIFIER_WORDS = new Set([
  ...QUALIFIER_WORDS,
  ...PREP_WORDS.flatMap((phrase) => phrase.split(" ")),
]);

const PLURAL_EXCEPTIONS = new Set(["molasses", "asparagus", "couscous", "hummus", "greens", "oats", "grits"]);

/** Lowercase, singularized, prep-stripped form used for pantry matching and list merging. */
export function canonicalize(item: string): string {
  let s = item.toLowerCase().trim();
  s = s.replace(/\([^)]*\)/g, " "); // parenthetical sizes: "(14.5 oz)"

  // Recipes offer alternatives constantly — "butter or vegetable oil", "milk of
  // choice or water". Only the first can be the key, or the pantry never matches.
  // Known limitation: "chicken or vegetable stock" reduces to "chicken", losing
  // the shared noun. Telling that apart from "butter or vegetable oil" needs a
  // food lexicon; the model-backed path already produces clean names.
  s = s.split(/\bor\b/)[0] ?? s;
  s = s.replace(/\bof (?:your )?choice\b/g, " ");

  // A hyphenated modifier is one word, not two. Stripping half of one leaves
  // "stone-ground cornmeal" as "stone cornmeal", which is worse than leaving it
  // alone: it isn't a food, so the recipe matches nothing and never says why.
  s = s.replace(/\b[a-z]+(?:-[a-z]+)+\b/g, (compound) =>
    compound.split("-").some((part) => MODIFIER_WORDS.has(part)) ? " " : compound,
  );

  for (const p of PREP_WORDS) s = s.replace(new RegExp(String.raw`\b${p}\b`, "g"), " ");
  s = s.replace(QUALIFIER_PATTERN, " ");
  s = s.replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  s = s.replace(/^\d+(?:\.\d+)? /, ""); // a leading bare count is not part of the name

  const words = s.split(" ");
  const last = words[words.length - 1];
  if (last && !PLURAL_EXCEPTIONS.has(last)) {
    if (/ies$/.test(last)) words[words.length - 1] = last.replace(/ies$/, "y");
    else if (/(ches|shes|xes|sses|oes)$/.test(last)) words[words.length - 1] = last.replace(/es$/, "");
    else if (/[^s]s$/.test(last)) words[words.length - 1] = last.slice(0, -1);
  }
  return words.filter(Boolean).join(" ");
}

/**
 * Deterministic parse of a single ingredient line. Used on the schema.org path
 * where sites hand us plain strings and we'd rather not pay for a model call.
 * Anything it can't confidently split stays intact in `raw` and `item`.
 */
export function parseIngredientLine(line: string, group: string | null = null): Ingredient {
  const raw = line.replace(/\s+/g, " ").trim();
  let rest = raw;

  const optional = /\boptional\b/i.test(raw);

  // Thirds and sixths come out of fraction division as long repeating decimals;
  // three places is well past any real measuring precision.
  const round3 = (n: number) => Number(n.toFixed(3));

  const first = parseQuantity(rest);
  let quantity: number | null = null;
  let quantityMax: number | null = null;
  if (first) {
    quantity = round3(first.value);
    rest = first.rest.trim();
    const range = /^(?:-|–|—|to)\s*/.exec(rest);
    if (range) {
      const second = parseQuantity(rest.slice(range[0].length));
      if (second) {
        quantityMax = round3(second.value);
        rest = second.rest.trim();
      }
    }
  }

  // A parenthetical right after the amount is a package size, not the unit: "1 (14 oz) can ..."
  rest = rest.replace(/^\([^)]*\)\s*/, "");

  let unit: string | null = null;
  const unitMatch = /^([a-zA-Z]+\.?)\s+/.exec(rest);
  if (unitMatch) {
    const candidate = (unitMatch[1] as string).toLowerCase().replace(/\.$/, "");
    if (UNIT_LOOKUP.has(candidate)) {
      unit = UNIT_LOOKUP.get(candidate) as string;
      rest = rest.slice(unitMatch[0].length).trim();
    }
  }
  rest = rest.replace(/^of\s+/i, "");
  // Metric equivalents often sit between the unit and the food: "1 cup (225 grams) bananas".
  rest = rest.replace(/^\([^)]*\)\s*/, "");

  // Everything after the first comma is prep, not identity.
  const commaAt = rest.indexOf(",");
  let item = commaAt >= 0 ? rest.slice(0, commaAt) : rest;
  let notes = commaAt >= 0 ? rest.slice(commaAt + 1).trim() : null;
  item = item.replace(/\s+/g, " ").trim();
  if (notes === "") notes = null;

  return {
    raw,
    quantity,
    quantityMax,
    unit,
    item: item || raw,
    canonicalItem: canonicalize(item || raw),
    notes,
    optional,
    group,
  };
}

/** Scale an amount for a different serving count, rounded to something a cook can measure. */
export function scaleQuantity(q: number | null, factor: number): number | null {
  if (q === null) return null;
  const scaled = q * factor;
  if (scaled >= 10) return Math.round(scaled);
  const eighths = Math.round(scaled * 8) / 8;
  return Number(eighths.toFixed(3));
}

const FRACTION_GLYPHS: [number, string][] = [
  [0.125, "⅛"], [0.25, "¼"], [1 / 3, "⅓"], [0.375, "⅜"], [0.5, "½"],
  [0.625, "⅝"], [2 / 3, "⅔"], [0.75, "¾"], [0.875, "⅞"],
];

/** Render a decimal amount the way a recipe would write it: 1.5 -> "1½". */
export function formatQuantity(q: number | null): string {
  if (q === null) return "";
  if (Number.isInteger(q)) return String(q);

  const whole = Math.floor(q);
  const frac = q - whole;
  const glyph = FRACTION_GLYPHS.find(([value]) => Math.abs(frac - value) < 0.02)?.[1];
  if (!glyph) return String(Number(q.toFixed(2)));
  return whole > 0 ? `${whole}${glyph}` : glyph;
}

/**
 * The amount column of an ingredient line: "1½ cup", "2-3 clove", "" when
 * unstated. `quantityMax` is optional so pantry entries, which never carry a
 * range, can use this too.
 */
export function formatAmount(
  ing: Pick<Ingredient, "quantity" | "unit"> & { quantityMax?: number | null },
): string {
  const lo = formatQuantity(ing.quantity);
  const hi = formatQuantity(ing.quantityMax ?? null);
  const amount = lo && hi ? `${lo}-${hi}` : lo;
  return [amount, ing.unit ?? ""].filter(Boolean).join(" ");
}

/**
 * A duration written in plain English ("45 minutes", "1 hour", "1 h 20 min",
 * a bare number meaning minutes) -> minutes. Not anchored to the start of the
 * string, so it also reads a duration embedded in a longer phrase ("about 45
 * min", "1.5 hours ahead"). Shared by every place that has to read a source's
 * own free-text time field rather than a machine-readable one — a page's
 * schema.org data falls back to this when it isn't a real ISO-8601 duration,
 * and a structured import from another app (Paprika, ...) uses it directly
 * since it never has ISO durations to begin with.
 */
export function parsePlainDuration(text: string): number | null {
  const s = text.toLowerCase();
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

/** "1h 15m" / "45 min" — how long the whole thing takes, said plainly. */
export function formatMinutes(minutes: number | null): string | null {
  if (minutes === null || minutes <= 0) return null;
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
