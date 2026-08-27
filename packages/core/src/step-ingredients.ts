import type { Ingredient, Step } from "./recipe.js";

/**
 * Which ingredients a step is talking about.
 *
 * Mid-cook, "add the flour and the sugar" is missing the only thing you need
 * to know: how much. The amounts are three screens up in a list you'd have to
 * leave the step to read, with wet hands, on a phone that's about to sleep.
 *
 * So each step carries the amounts for the things it mentions. Nothing new is
 * stored — it's the ingredient list and the step text, matched.
 *
 * The matching is deliberately cautious. A wrong amount attached to a step is
 * worse than no amount at all: no amount sends someone to the ingredient list,
 * a wrong one sends them to the bin.
 */

/** Words that carry no meaning for matching, so they can't be what a match hangs on. */
const STOP_WORDS = new Set([
  "and", "or", "the", "a", "an", "of", "with", "to", "for", "in", "on", "into",
  "until", "then", "add", "mix", "stir", "all", "some", "more", "fresh", "large",
  "small", "medium", "plain", "whole", "ground", "chopped", "sliced", "diced",
]);

/**
 * Word forms a token should also match.
 *
 * Canonical names are singular ("egg") and steps are usually not ("beat the
 * eggs"), so a match has to survive the plural. This is deliberately a handful
 * of suffix rules rather than a stemmer: an over-eager stemmer conflates
 * "butter" with "but", and being wrong here means printing the wrong number
 * next to a step.
 */
function forms(word: string): string[] {
  const out = [word];
  if (word.endsWith("y") && word.length > 3) out.push(`${word.slice(0, -1)}ies`);
  if (/(s|x|z|ch|sh)$/.test(word)) out.push(`${word}es`);
  else out.push(`${word}s`);
  if (word.endsWith("f")) out.push(`${word.slice(0, -1)}ves`);
  if (word.endsWith("o")) out.push(`${word}es`);
  return out;
}

const words = (text: string): string[] =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);

/** The name to match on, preferring the canonical form the rest of the app uses. */
const nameOf = (ingredient: Ingredient): string =>
  ingredient.canonicalItem || ingredient.item || ingredient.raw;

/** Where `phrase` appears in `haystack` as consecutive whole words, plurals allowed. */
interface Span {
  start: number;
  end: number;
}

function spansOf(haystack: readonly string[], phrase: readonly string[]): Span[] {
  if (phrase.length === 0) return [];
  const spans: Span[] = [];

  for (let i = 0; i + phrase.length <= haystack.length; i++) {
    let matched = true;
    for (let j = 0; j < phrase.length; j++) {
      // Only the last word of a phrase gets to be plural: "olive oils" is odd
      // but real, "olives oil" is not.
      const allowed = j === phrase.length - 1 ? forms(phrase[j]!) : [phrase[j]!];
      if (!allowed.includes(haystack[i + j]!)) {
        matched = false;
        break;
      }
    }
    if (matched) spans.push({ start: i, end: i + phrase.length });
  }
  return spans;
}

const covers = (outer: Span, inner: Span): boolean =>
  outer.start <= inner.start && outer.end >= inner.end && outer.end - outer.start > inner.end - inner.start;

/**
 * Things a recipe makes rather than buys.
 *
 * These can't be resolved by shorthand. "Fold the tofu into the sauce" means
 * the dressing made two steps ago, not the bottle of hot sauce in the list —
 * but the head-noun rule can't tell those apart, because both are "sauce". A
 * full-phrase match still counts: a step that actually says "hot sauce" gets
 * its amount.
 */
const MADE_IN_RECIPE = new Set([
  "sauce", "dressing", "mixture", "batter", "dough", "marinade", "glaze",
  "filling", "topping", "base", "crust", "syrup", "stock", "broth", "paste",
]);

/**
 * Words describing what form a thing comes in, rather than what it is.
 *
 * "Vanilla extract" is still vanilla and "garlic powder" is still garlic, so
 * for these the *first* word can stand for the whole name — which matters,
 * because a step that lists "sugar, butter, eggs and vanilla" is naming the
 * extract.
 *
 * "Brown sugar" gets no such licence, because "sugar" isn't a form word — and
 * that is exactly what stops "Brown the meat" from being read as an ingredient.
 */
const FORM_WORDS = new Set([
  "extract", "essence", "powder", "flake", "flakes", "granule", "granules",
  "concentrate", "puree", "zest", "seed", "seeds", "leaf", "leaves", "sprig",
  "sprigs", "clove", "cloves",
]);

/**
 * Single words that belong to exactly one ingredient.
 *
 * A step rarely repeats a full name. Having said "extra-virgin olive oil" in
 * the list it says "the oil"; having said "vanilla extract" it says "vanilla".
 *
 * Two rules keep that from going wrong. Only the last word can stand for the
 * whole — plus the first, when the last is a form word — so an adjective can't
 * be mistaken for the thing. And the word has to belong to one ingredient
 * only: with an olive oil and a sesame oil in the same recipe, "the oil" is
 * genuinely ambiguous and gets no amount rather than a coin-flip.
 */
function unambiguousWords(ingredients: readonly Ingredient[]): Map<string, Ingredient> {
  const counts = new Map<string, number>();
  const candidates: [string, Ingredient][] = [];

  for (const ingredient of ingredients) {
    const parts = words(nameOf(ingredient));

    // Every word counts towards ambiguity, even from a single-word name: a
    // recipe holding both "garlic" and "garlic powder" must not resolve a bare
    // "garlic" to either by shorthand.
    for (const part of new Set(parts)) {
      if (STOP_WORDS.has(part) || MADE_IN_RECIPE.has(part)) continue;
      counts.set(part, (counts.get(part) ?? 0) + 1);
    }

    if (parts.length < 2) continue;
    const last = parts[parts.length - 1]!;
    const usable = (word: string) => !STOP_WORDS.has(word) && !MADE_IN_RECIPE.has(word);

    if (usable(last)) candidates.push([last, ingredient]);
    if (FORM_WORDS.has(last) && usable(parts[0]!)) candidates.push([parts[0]!, ingredient]);
  }

  const unique = new Map<string, Ingredient>();
  for (const [word, ingredient] of candidates) {
    if (counts.get(word) === 1) unique.set(word, ingredient);
  }
  return unique;
}

/**
 * The ingredients a step mentions, in the order the recipe lists them.
 *
 * Recipe order rather than order-of-mention: the amounts read as a checklist
 * beside the step, and a checklist should match the list it came from.
 */
export function ingredientsForStep(
  step: Pick<Step, "text">,
  ingredients: readonly Ingredient[],
): Ingredient[] {
  const haystack = words(step.text);
  if (haystack.length === 0) return [];

  const shorthand = unambiguousWords(ingredients);
  const spans = new Map<Ingredient, Span[]>();

  for (const ingredient of ingredients) {
    const phrase = words(nameOf(ingredient)).filter((w) => !STOP_WORDS.has(w));
    if (phrase.length === 0) continue;
    const hits = spansOf(haystack, phrase);
    if (hits.length > 0) spans.set(ingredient, hits);
  }

  // Then the shorthand, for anything the full name missed.
  for (const [word, ingredient] of shorthand) {
    if (spans.has(ingredient)) continue;
    const hits = spansOf(haystack, [word]);
    if (hits.length > 0) spans.set(ingredient, hits);
  }

  // A shorter name must not claim a mention a longer one already covers. A
  // recipe with both "garlic" and "garlic powder" in it hits this on any step
  // that says "garlic powder": the bare garlic matches the first word, and a
  // cook would be told to add a clove that isn't wanted yet.
  const all = [...spans.values()].flat();
  const found = new Set<Ingredient>();
  for (const [ingredient, hits] of spans) {
    const standsAlone = hits.some((hit) => !all.some((other) => covers(other, hit)));
    if (standsAlone) found.add(ingredient);
  }

  return ingredients.filter((i) => found.has(i));
}

/**
 * Every step's ingredients at once.
 *
 * Computed for the whole recipe rather than per step so the work happens once
 * when a cook session opens, not again on every step change.
 */
export function ingredientsByStep(
  steps: readonly Step[],
  ingredients: readonly Ingredient[],
): Map<number, Ingredient[]> {
  const byStep = new Map<number, Ingredient[]>();
  for (const step of steps) byStep.set(step.n, ingredientsForStep(step, ingredients));
  return byStep;
}
