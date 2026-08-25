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
];

const PLURAL_EXCEPTIONS = new Set(["molasses", "asparagus", "couscous", "hummus", "greens", "oats", "grits"]);

/** Lowercase, singularized, prep-stripped form used for pantry matching and list merging. */
export function canonicalize(item: string): string {
  let s = item.toLowerCase().trim();
  s = s.replace(/\([^)]*\)/g, " "); // parenthetical sizes: "(14.5 oz)"
  for (const p of PREP_WORDS) s = s.replace(new RegExp(String.raw`\b${p}\b`, "g"), " ");
  s = s.replace(/\b(fresh|freshly|large|small|medium|ripe|extra|virgin|whole|ground|raw|cooked|uncooked|boneless|skinless|low[- ]fat|non[- ]fat|unsalted|salted|plus more.*)\b/g, " ");
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

/** The amount column of an ingredient line: "1½ cup", "2-3 clove", "" when unstated. */
export function formatAmount(ing: Pick<Ingredient, "quantity" | "quantityMax" | "unit">): string {
  const lo = formatQuantity(ing.quantity);
  const hi = formatQuantity(ing.quantityMax);
  const amount = lo && hi ? `${lo}-${hi}` : lo;
  return [amount, ing.unit ?? ""].filter(Boolean).join(" ");
}

/** "1h 15m" / "45 min" — how long the whole thing takes, said plainly. */
export function formatMinutes(minutes: number | null): string | null {
  if (minutes === null || minutes <= 0) return null;
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
