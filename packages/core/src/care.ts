import { flagsForRecipe, type Allergen, type DietaryTag } from './dietary.js';
import { canonicalize } from './units.js';

export const CARE_EFFORTS = ['open', 'microwave', 'one_pan', 'cook'] as const;
export const CARE_TIMES = ['two', 'ten', 'twenty'] as const;
export const CARE_TEXTURES = ['crunchy', 'soft', 'smooth', 'plain', 'any'] as const;
export type CareEffort = typeof CARE_EFFORTS[number];
export interface CareChoices {
  effort?: CareEffort;
  time?: typeof CARE_TIMES[number];
  temperature?: 'cold' | 'warm' | 'any';
  texture?: typeof CARE_TEXTURES[number];
  appetite?: 'small' | 'regular' | 'more';
  usePantry?: boolean;
}
export interface CareLink extends CareChoices {
  source?: 'wispling';
  intent?: 'eat_now';
  return_to?: 'wispling://care-return';
}
export const CARE_RETURN = 'wispling://care-return' as const;
export const CARE_DISCLAIMER = 'Suggestions are not verified for allergens. Check ingredients and packaging, including cross-contact information. No match is a guarantee of safety.';
export const CARE_LIMITS = { two: 2, ten: 10, twenty: 20 } as const;
export const CARE_EFFORT_LABELS = { open: 'Open and eat', microwave: 'Microwave or less', one_pan: 'One pan or less', cook: 'I can cook' };

/** Read only explicitly supported scalar fields. Never carry arbitrary query data forward. */
export function parseCareLink(value: unknown): CareLink {
  const out: CareLink = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  // Values inherited from another object are not query parameters.
  const input: Record<string, unknown> = {};
  for (const name of ['source', 'intent', 'effort', 'time', 'temperature', 'texture', 'return_to']) {
    if (Object.hasOwn(value, name)) input[name] = (value as Record<string, unknown>)[name];
  }
  if (input.source === 'wispling') out.source = 'wispling';
  if (input.intent === 'eat_now') out.intent = 'eat_now';
  if (CARE_EFFORTS.includes(input.effort as CareEffort)) out.effort = input.effort as CareEffort;
  if (CARE_TIMES.includes(input.time as NonNullable<CareChoices['time']>)) out.time = input.time as CareChoices['time'];
  if (['cold', 'warm', 'any'].includes(input.temperature as string)) out.temperature = input.temperature as CareChoices['temperature'];
  if (CARE_TEXTURES.includes(input.texture as NonNullable<CareChoices['texture']>)) out.texture = input.texture as CareChoices['texture'];
  if (input.return_to === CARE_RETURN) out.return_to = CARE_RETURN;
  return out;
}

export interface CareFood {
  id: string;
  title: string;
  description: string;
  effort: CareEffort;
  minutes: number;
  temperature: 'cold' | 'warm';
  textures: readonly string[];
  ingredients: readonly string[];
  dietaryTags: readonly DietaryTag[];
  portions: readonly NonNullable<CareChoices['appetite']>[];
  steps: readonly string[];
  shoppingItem: string;
}
const plant: DietaryTag[] = ['vegan', 'vegetarian', 'pescatarian', 'dairy-free'];
const fruit: DietaryTag[] = [...plant, 'gluten-free'];
const allPortions = ['small', 'regular', 'more'] as const;
function food(id: string, title: string, description: string, effort: CareEffort, minutes: number, temperature: 'cold'|'warm', textures: string[], ingredients: string[], dietaryTags: DietaryTag[], steps: string[], shoppingItem: string, portions: CareFood['portions'] = allPortions): CareFood {
  return { id, title, description, effort, minutes, temperature, textures, ingredients, dietaryTags, steps, shoppingItem, portions };
}
/** Explicitly authored possibilities. No inference about what a user has eaten or needs. */
export const CARE_FOODS: readonly CareFood[] = [
  food('banana', 'A banana, just as it is', 'Something simple, with no washing up.', 'open', 1, 'cold', ['soft', 'plain'], ['banana'], fruit, ['Peel a banana.', 'Have as much or as little as you want.'], 'banana', ['small', 'regular']),
  food('apple', 'Apple slices', 'A little crunch, at your pace.', 'open', 2, 'cold', ['crunchy', 'plain'], ['apple'], fruit, ['Wash an apple.', 'Slice it, or eat it whole.'], 'apple', ['small', 'regular']),
  food('applesauce', 'A pot of applesauce', 'Open the lid. That can be enough preparation.', 'open', 1, 'cold', ['smooth', 'soft', 'plain'], ['apple puree'], fruit, ['Choose a pot whose ingredients work for you.', 'Open it and grab a spoon.'], 'applesauce', ['small', 'regular']),
  food('crackers', 'Rice crackers and cucumber', 'A small plate of familiar things.', 'open', 2, 'cold', ['crunchy', 'plain'], ['rice cracker', 'cucumber'], fruit, ['Check the crackers label for your restrictions.', 'Put crackers and washed cucumber on a plate.'], 'rice cracker'),
  food('yogurt', 'Yogurt and a banana', 'A bowl, a spoon, and very little else.', 'open', 2, 'cold', ['soft', 'smooth'], ['yogurt', 'banana'], ['vegetarian', 'pescatarian', 'gluten-free'], ['Check your yogurt label.', 'Spoon into a bowl and add banana if you like.'], 'yogurt'),
  food('hummus', 'Hummus with cucumber', 'Ready-made counts, too.', 'open', 2, 'cold', ['crunchy'], ['chickpea', 'tahini', 'cucumber'], fruit, ['Check the hummus label; many versions contain sesame.', 'Add washed cucumber for dipping.'], 'hummus'),
  food('cereal', 'Cereal with oat milk', 'A familiar bowl without switching on the stove.', 'open', 2, 'cold', ['crunchy'], ['cereal', 'oat milk'], plant, ['Check both package labels.', 'Pour a bowl in the amount that suits you.'], 'cereal'),
  food('rice', 'A warm bowl of rice', 'A microwave pouch keeps this small.', 'microwave', 3, 'warm', ['soft', 'plain'], ['rice'], fruit, ['Choose a ready-to-heat rice pouch and check its label.', 'Heat exactly as the package directs.', 'Open carefully and let the steam clear.'], 'microwave rice'),
  food('oatmeal', 'Easy warm oats', 'A quiet bowl with very little preparation.', 'microwave', 5, 'warm', ['soft', 'plain'], ['oat'], plant, ['Check the oats package for ingredients and preparation directions.', 'Combine with water and microwave as directed in a suitable bowl.', 'Let it cool to a comfortable temperature.'], 'oat'),
  food('beans', 'A bowl of warm beans', 'Use a ready-cooked tin or pouch.', 'microwave', 5, 'warm', ['soft'], ['cooked bean'], fruit, ['Check the label and choose ready-cooked beans.', 'Transfer to a microwave-safe bowl; never microwave the tin.', 'Heat according to the package directions.'], 'cooked bean'),
  food('potato', 'A microwave potato', 'One potato and a little patience.', 'microwave', 10, 'warm', ['soft', 'plain'], ['potato'], fruit, ['Wash and pierce a potato.', 'Use your microwave potato setting and check it is cooked through.', 'Allow it to stand, then open carefully.'], 'potato'),
  food('scramble', 'Soft scrambled eggs', 'One pan, a fork, and toast if you want it.', 'one_pan', 10, 'warm', ['soft', 'plain'], ['egg', 'olive oil'], ['vegetarian', 'pescatarian', 'dairy-free', 'gluten-free', 'keto'], ['Beat the eggs with a fork.', 'Warm a little oil in a pan.', 'Stir the eggs gently until cooked through.'], 'egg'),
  food('pasta', 'Pasta with olive oil', 'Keep the finishing touches optional.', 'cook', 20, 'warm', ['soft', 'plain'], ['pasta', 'olive oil'], plant, ['Check the pasta label.', 'Cook in water according to the package.', 'Drain carefully and add a little olive oil.'], 'pasta'),
  food('peas', 'Warm peas and rice', 'Two freezer or cupboard standbys.', 'microwave', 10, 'warm', ['soft'], ['pea', 'rice'], fruit, ['Check both package labels.', 'Cook frozen peas and ready-to-heat rice as directed.', 'Combine in a bowl.'], 'frozen pea'),
];

export interface CareContext { allergens?: readonly Allergen[]; dietaryTags?: readonly DietaryTag[]; pantry?: readonly string[] }
export interface CareSuggestion { kind: 'now' | 'more' | 'future'; label: string; food: CareFood; pantryMatches: number }
export function suggestCare(choices: CareChoices = {}, context: CareContext = {}): CareSuggestion[] {
  const maxEffort = CARE_EFFORTS.indexOf(choices.effort ?? 'cook');
  const pantry = new Set((context.pantry ?? []).map(canonicalize).filter(Boolean));
  const possible = CARE_FOODS.filter(item =>
    CARE_EFFORTS.indexOf(item.effort) <= maxEffort &&
    item.minutes <= CARE_LIMITS[choices.time ?? 'twenty'] &&
    (!choices.temperature || choices.temperature === 'any' || item.temperature === choices.temperature) &&
    (!choices.texture || choices.texture === 'any' || item.textures.includes(choices.texture)) &&
    (!choices.appetite || item.portions.includes(choices.appetite)) &&
    (context.dietaryTags ?? []).every(tag => item.dietaryTags.includes(tag)) &&
    flagsForRecipe(item.ingredients.map(canonicalItem => ({ canonicalItem, optional: false })), context.allergens ?? []).length === 0
  ).map(item => ({ food: item, pantryMatches: item.ingredients.filter(x => pantry.has(canonicalize(x))).length }));
  possible.sort((a, b) => (
    choices.usePantry
      ? Number(b.pantryMatches === b.food.ingredients.length) - Number(a.pantryMatches === a.food.ingredients.length) || b.pantryMatches - a.pantryMatches
      : 0
  ) || a.food.minutes - b.food.minutes || (a.food.id < b.food.id ? -1 : a.food.id > b.food.id ? 1 : 0));
  const [first, second, future] = possible;
  if (!first) return [];
  return [
    { ...first, kind: 'now' as const, label: 'Right now' },
    ...(second ? [{ ...second, kind: 'more' as const, label: 'A little more' }] : []),
    ...(future ? [{ ...future, kind: 'future' as const, label: 'Future me' }] : []),
  ];
}

/** Server supplies verified Clerk identity. Query strings and public flags cannot grant access. */
export function betaAccess(input: { enabled?: string; nodeEnv?: string; localPreview?: string; userId?: string | null; allowedIds?: string }): boolean {
  if (input.enabled !== 'true') return false;
  if (input.nodeEnv === 'development' && input.localPreview === 'true') return true;
  return !!input.userId && (input.allowedIds ?? '').split(',').map(x => x.trim()).filter(Boolean).includes(input.userId);
}
