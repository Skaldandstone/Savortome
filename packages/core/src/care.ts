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
  // Smooth and soft were the thinnest part of this list and the likeliest
  // things to be asked for: two smooth options existed in the whole
  // catalogue, so anyone who chose "smooth" was shown everything there was.
  // Nothing below needs a recipe - it is a shelf, a lid, or a microwave.
  food('pear', 'Tinned pears', 'Soft enough to need no chewing.', 'open', 1, 'cold', ['soft', 'smooth', 'plain'], ['pear'], fruit, ['Choose a tin or pot whose ingredients work for you.', 'Open it and eat straight from the pot if that is easier.'], 'tinned pear', ['small', 'regular']),
  food('puree', 'A fruit puree pouch', 'No bowl, no spoon, no washing up.', 'open', 1, 'cold', ['smooth', 'soft'], ['fruit puree'], fruit, ['Check the pouch for ingredients that work for you.', 'Squeeze straight from the pouch.'], 'fruit puree pouch', ['small', 'regular']),
  food('smoothie', 'A bottled smoothie', 'Drinking is sometimes easier than eating.', 'open', 1, 'cold', ['smooth'], ['fruit smoothie'], fruit, ['Check the bottle for ingredients that work for you.', 'Pour as much as you want; the rest keeps in the fridge.'], 'bottled smoothie'),
  food('avocado', 'Avocado with a spoon', 'Halve it and eat it straight from the skin.', 'open', 2, 'cold', ['soft', 'smooth', 'plain'], ['avocado'], [...plant, 'gluten-free', 'keto'], ['Halve a ripe avocado and lift out the stone.', 'Eat straight from the skin with a spoon.'], 'avocado', ['small', 'regular']),
  food('kefir', 'A glass of drinking yogurt', 'Cold, smooth, and already made.', 'open', 1, 'cold', ['smooth'], ['yogurt'], ['vegetarian', 'pescatarian', 'gluten-free'], ['Check the bottle label.', 'Pour a small glass; there is no wrong amount.'], 'drinking yogurt', ['small', 'regular']),
  food('cheese_crackers', 'Cheese and rice crackers', 'Salty and familiar, straight from the fridge.', 'open', 2, 'cold', ['crunchy', 'plain'], ['cheese', 'rice cracker'], ['vegetarian', 'pescatarian', 'gluten-free'], ['Check the cracker and cheese labels.', 'Put a few on a plate and sit down with them.'], 'cheese'),
  food('broth', 'A mug of warm broth', 'Something warm to hold, if eating feels like too much.', 'microwave', 3, 'warm', ['smooth', 'plain'], ['vegetable broth'], plant, ['Check the carton or cube label; some contain wheat.', 'Heat a mug as the package directs.', 'Let it cool enough to hold comfortably.'], 'vegetable broth', ['small', 'regular']),
  food('soup', 'A smooth soup', 'A carton, a mug, and nothing to chew.', 'microwave', 5, 'warm', ['smooth'], ['ready-made soup'], ['vegetarian', 'pescatarian'], ['Check the carton label; smooth soups often contain milk or wheat.', 'Heat as the package directs.', 'Let it cool to a comfortable temperature.'], 'ready-made soup'),
  food('mash', 'Soft mashed potato', 'Warm, smooth, and quiet to eat.', 'microwave', 8, 'warm', ['smooth', 'soft', 'plain'], ['potato'], fruit, ['Wash and pierce a potato, or use a ready-made pot and check its label.', 'Microwave until soft the whole way through.', 'Mash with a fork and let it cool a little.'], 'potato'),
  food('congee', 'Soft rice porridge', 'Rice cooked far past the point of needing to chew.', 'microwave', 8, 'warm', ['smooth', 'soft', 'plain'], ['rice'], fruit, ['Use a ready-to-heat rice pouch and check its label.', 'Add extra water and heat until it loosens into porridge.', 'Let it cool to a comfortable temperature.'], 'microwave rice'),
  food('toast', 'Toast, plain or with a little oil', 'The whole recipe is bread and heat.', 'one_pan', 5, 'warm', ['crunchy', 'plain'], ['bread', 'olive oil'], plant, ['Check the bread label.', 'Toast a slice as dark as you like it.', 'A little olive oil is optional.'], 'bread'),
  food('poached_egg', 'A softly poached egg', 'One egg, one pan of water.', 'one_pan', 8, 'warm', ['soft', 'plain'], ['egg'], ['vegetarian', 'pescatarian', 'dairy-free', 'gluten-free', 'keto'], ['Bring a small pan of water to a gentle simmer.', 'Slide in an egg and leave it alone for three minutes.', 'Lift it out and let it drain.'], 'egg', ['small', 'regular']),
  food('noodle_soup', 'Soft noodles in broth', 'Slippery and warm, and it asks very little of you.', 'cook', 12, 'warm', ['soft'], ['noodle', 'vegetable broth'], plant, ['Check the noodle and broth labels.', 'Simmer the broth and cook the noodles in it until soft.', 'Let it cool to a comfortable temperature.'], 'noodle'),
  food('vegetable_soup', 'A pan of vegetable soup', 'Worth making when you have a little more in you.', 'cook', 20, 'warm', ['smooth', 'soft'], ['carrot', 'potato', 'vegetable broth'], [...plant, 'gluten-free'], ['Check the broth label.', 'Simmer chopped carrot and potato in broth until they give way easily.', 'Blend or mash, and let it cool enough to eat.'], 'carrot'),
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
  if (possible.length === 0) return [];

  // Asking to use the pantry is a specific request - show me what I already
  // have - and it outranks any spreading. The ordering above already puts
  // complete matches first, so take it as it stands whenever it found
  // something.
  const pantryLed = choices.usePantry && possible.some(x => x.pantryMatches > 0);

  // Otherwise: "Right now", "A little more" and "Future me" promise three
  // different amounts of effort. Filling them with the first three of a list
  // sorted by time delivered three versions of the same thing - a banana,
  // some applesauce, and a banana with yogurt on it - which reads as the page
  // ignoring what was asked for. Spread the slots across the range instead,
  // and prefer options built on different foods.
  const chosen =
    pantryLed || possible.length <= 2 ? possible.slice(0, 3) : spreadAcrossEffort(possible);

  const labels = [
    { kind: 'now' as const, label: 'Right now' },
    { kind: 'more' as const, label: 'A little more' },
    { kind: 'future' as const, label: 'Future me' },
  ];
  return chosen.map((entry, index) => ({ ...entry, ...labels[index]! }));
}

type Candidate = { food: CareFood; pantryMatches: number };

/**
 * Roughly how much of a person a suggestion asks for.
 *
 * Effort dominates: standing at a hob is a bigger ask than waiting on a
 * microwave, however few minutes it takes. Minutes only separate options
 * within the same kind of effort, so the multiplier just has to exceed the
 * twenty-minute ceiling.
 */
function demandOf(food: CareFood): number {
  return CARE_EFFORTS.indexOf(food.effort) * 30 + food.minutes;
}

/**
 * Three options taken from the bottom, middle and top of what is possible,
 * skipping anything built on a food already suggested.
 *
 * The lightest option always leads: whoever is reading this may only manage
 * the first card, and it should be the easiest thing available. The heaviest
 * anchors the other end so "Future me" is genuinely something to come back
 * for. The middle sits between them.
 */
function spreadAcrossEffort(possible: Candidate[]): Candidate[] {
  const byDemand = [...possible].sort(
    (a, b) => demandOf(a.food) - demandOf(b.food) || (a.food.id < b.food.id ? -1 : 1),
  );
  const lightest = byDemand[0]!;
  const heaviest = pickDistinct(byDemand.slice(1).reverse(), [lightest]) ?? byDemand[byDemand.length - 1]!;

  // Nearest the midpoint of the two ends, so the ladder has an even tread.
  const midpoint = (demandOf(lightest.food) + demandOf(heaviest.food)) / 2;
  const middle = pickDistinct(
    [...byDemand].sort(
      (a, b) => Math.abs(demandOf(a.food) - midpoint) - Math.abs(demandOf(b.food) - midpoint),
    ),
    [lightest, heaviest],
  );

  return [lightest, middle, heaviest].filter((x): x is Candidate => Boolean(x));
}

/**
 * The first candidate that is neither already taken nor shares an ingredient
 * with something already taken.
 *
 * Every ingredient counts, not just the first one. Comparing only the main
 * ingredient still let "a banana" and "yogurt and a banana" sit side by side,
 * which is the repetition this is meant to prevent - to the person reading
 * the page they are the same suggestion twice.
 *
 * It is only a preference: when every remaining option overlaps, a repeated
 * ingredient beats an empty slot.
 */
function pickDistinct(ordered: Candidate[], taken: Candidate[]): Candidate | undefined {
  const takenFoods = new Set(taken.map(x => x.food.id));
  const takenIngredients = new Set(taken.flatMap(x => x.food.ingredients));
  const free = ordered.filter(x => !takenFoods.has(x.food.id));
  return free.find(x => x.food.ingredients.every(i => !takenIngredients.has(i))) ?? free[0];
}

/** Server supplies verified Clerk identity. Query strings and public flags cannot grant access. */
export function betaAccess(input: { enabled?: string; nodeEnv?: string; localPreview?: string; userId?: string | null; allowedIds?: string; publicAccess?: string }): boolean {
  if (input.enabled !== 'true') return false;
  // Exact 'true' opens the experience to every visitor. Account-bound data
  // still requires a signed-in user at each read site; this only removes the
  // owner-approval cohort gate in front of the woodland experience.
  if (input.publicAccess === 'true') return true;
  if (input.nodeEnv === 'development' && input.localPreview === 'true') return true;
  return !!input.userId && (input.allowedIds ?? '').split(',').map(x => x.trim()).filter(Boolean).includes(input.userId);
}
