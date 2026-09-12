/**
 * What a cook can manage, what a recipe asks for, and how honestly to put the
 * two together.
 *
 * The point of all this is not to grade anybody. It is to stop handing someone
 * a recipe that needs a stand mixer and twenty minutes of confident knife work
 * on the night they have one pan and forty minutes. Recipes above a cook's
 * level are never hidden - they are offered as challenges, with the reason
 * stated, because "this asks more of you than usual" is an invitation and
 * "you cannot have this" is a wall.
 *
 * Nothing here reaches the care experience. `/care` is for people who are ill,
 * and a skill tier has no business anywhere near it; `care.test.ts` holds that
 * boundary as an actual test rather than a note.
 */

// --- the ladder --------------------------------------------------------------

/** Stable keys. Display strings live in the records below and may change. */
export const COOK_TIERS = ["apprentice", "adept", "artisan", "alchemist", "sage"] as const;
export type CookTier = (typeof COOK_TIERS)[number];

export const COOK_TIER_LABEL: Record<CookTier, string> = {
  apprentice: "Curious Apprentice",
  adept: "Careful Adept",
  artisan: "Confident Artisan",
  alchemist: "Kitchen Alchemist",
  sage: "Kitchen Sage",
};

/**
 * Filked film lines, one per rung.
 *
 * Each is altered rather than quoted, and each has to work for someone who
 * does not catch the reference - a line that is only a reference is a dead
 * line for most people. The attribution is the joke's tell: it credits the
 * riff and makes clear we are not passing off a real quote.
 */
export const COOK_TIER_QUOTE: Record<CookTier, { line: string; character: string }> = {
  apprentice: { line: "That dinner was only mostly dead.", character: "Miracle Max" },
  adept: {
    line: "Dinner is never late. It arrives precisely when I mean it to.",
    character: "Gandalf",
  },
  artisan: { line: "That's my secret. I'm always seasoning.", character: "Bruce Banner" },
  alchemist: { line: "I made the dinner an offer it couldn't refuse.", character: "Don Corleone" },
  sage: { line: "I am burdened with glorious leftovers.", character: "Loki" },
};

/** Shown once beneath the five, carrying the asterisk from each attribution. */
export const COOK_TIER_FOOTNOTE =
  "We're pretty sure these are right. It's been a while since we watched " +
  "The Princess Bride, The Fellowship of the Ring, The Avengers and The Godfather. " +
  "Consider it a viewing list for your next long simmer.";

/** Where a tier sits, 1-5, for comparing against what a recipe asks. */
export function tierRank(tier: CookTier): number {
  return COOK_TIERS.indexOf(tier) + 1;
}

// --- the individual skills ---------------------------------------------------

/**
 * The broad strokes, deliberately few.
 *
 * Someone answering these is tired and wants to cook, not fill in a form, so
 * this asks about four things they can judge about themselves in a second
 * rather than a dozen they would have to think about.
 */
export const KITCHEN_SKILLS = ["knife", "stovetop", "oven", "timing"] as const;
export type KitchenSkill = (typeof KITCHEN_SKILLS)[number];

export const KITCHEN_SKILL_LABEL: Record<KitchenSkill, string> = {
  knife: "Knife work",
  stovetop: "Stovetop",
  oven: "Baking and roasting",
  timing: "Juggling timings",
};

export const KITCHEN_SKILL_HINT: Record<KitchenSkill, string> = {
  knife: "Chopping, dicing, breaking down a chicken.",
  stovetop: "Heat control, searing, sauces that could split.",
  oven: "Bread, pastry, anything that rises or has to come out at the right moment.",
  timing: "Getting three things to be ready at the same time.",
};

/** 1 is "I would rather not", 5 is "no notes". */
export type SkillLevel = 1 | 2 | 3 | 4 | 5;
export const SKILL_LEVELS: readonly SkillLevel[] = [1, 2, 3, 4, 5];

/** Partial on purpose: someone may rate one skill and skip the rest. */
export type SkillRatings = Partial<Record<KitchenSkill, SkillLevel>>;

// --- what is in the kitchen --------------------------------------------------

export const KITCHEN_STOCKS = ["bare", "basic", "stocked", "equipped", "outfitted"] as const;
export type KitchenStock = (typeof KITCHEN_STOCKS)[number];

export const KITCHEN_STOCK_LABEL: Record<KitchenStock, string> = {
  bare: "One pan and a dream",
  basic: "The essentials",
  stocked: "A proper drawer",
  equipped: "Most of it, most days",
  outfitted: "Everything, and a place for it",
};

export const KITCHEN_STOCK_HINT: Record<KitchenStock, string> = {
  bare: "A pan, a wooden spoon, and a knife I am not proud of.",
  basic: "A decent knife, a couple of pans, a baking tray.",
  stocked: "Scales, a whisk, a sieve, and something that blends.",
  equipped: "A food processor, a thermometer, more pans than people.",
  outfitted: "If a recipe names it, I own it. Possibly two.",
};

/**
 * What each level is assumed to have, cumulatively.
 *
 * A guess, and a generous one: it is far worse to tell someone they cannot
 * cook something they could have than to let them discover they are missing a
 * sieve. Tool names are lowercase and canonical so import can match them.
 */
const STOCK_ADDS: Record<KitchenStock, readonly string[]> = {
  bare: ["pan", "pot", "knife", "spoon", "bowl"],
  basic: ["chef knife", "baking tray", "sheet pan", "saucepan", "skillet", "colander"],
  stocked: ["scale", "whisk", "sieve", "blender", "grater", "rolling pin", "casserole dish"],
  equipped: ["food processor", "thermometer", "dutch oven", "stand mixer", "cast iron"],
  outfitted: ["mandoline", "piping bag", "stick blender", "mortar and pestle", "steamer"],
};

/** Every tool a kitchen at this level is assumed to hold. */
export function toolsAtStock(stock: KitchenStock): ReadonlySet<string> {
  const upTo = KITCHEN_STOCKS.indexOf(stock);
  const tools = new Set<string>();
  for (let i = 0; i <= upTo; i++) {
    for (const tool of STOCK_ADDS[KITCHEN_STOCKS[i]!]!) tools.add(tool);
  }
  return tools;
}

// --- the profile and what a recipe asks for ----------------------------------

/**
 * Everything optional below the tier. The tier is one tap on first visit; the
 * skills and the kitchen are offered afterwards and can be skipped, so every
 * function here has to do something sensible with almost nothing.
 */
export interface CookProfile {
  tier?: CookTier;
  skills?: SkillRatings;
  stock?: KitchenStock;
}

/** What a recipe needs from whoever is cooking it. Filled in at import. */
export interface RecipeDemands {
  /** Highest level this recipe leans on, per skill. Absent means undemanding. */
  skills?: SkillRatings;
  /**
   * Canonical lowercase tool names, matching the vocabulary in STOCK_ADDS.
   * Recipes already carry a free-text `equipment` list; run it through
   * `canonicalTools` rather than storing a second copy of the same thing.
   */
  tools?: readonly string[];
}

/** A single skill where the recipe asks for more than the cook claimed. */
export interface SkillGap {
  skill: KitchenSkill;
  needs: SkillLevel;
  has: SkillLevel;
}

export type FitVerdict = "comfortable" | "stretch" | "challenge";

export interface RecipeFit {
  verdict: FitVerdict;
  /** Every skill the recipe asks more of, largest gap first. */
  gaps: readonly SkillGap[];
  /** Tools the recipe names that this kitchen probably does not have. */
  missingTools: readonly string[];
  /**
   * Why it is a stretch, in a sentence, or null when it is comfortable.
   * A challenge with no stated reason is just a locked door.
   */
  reason: string | null;
}

/**
 * What someone is assumed to be able to do when they have not said.
 *
 * Their tier stands in: an Apprentice is assumed 2 across the board, a Sage 5.
 * Assuming the middle for everyone would tell a Sage that a chicken is a
 * challenge, and an Apprentice that a laminated dough is fine.
 */
export function assumedSkill(profile: CookProfile, skill: KitchenSkill): SkillLevel {
  const stated = profile.skills?.[skill];
  if (stated) return stated;
  if (!profile.tier) return 3;
  return Math.min(5, Math.max(1, tierRank(profile.tier))) as SkillLevel;
}

/**
 * How a recipe sits with a particular cook.
 *
 * "Comfortable" is within reach. "Stretch" asks for a little more than they
 * claimed, in one place. "Challenge" asks for a lot more, or for equipment
 * they have not got - and both are still offered, because being shown only
 * what you can already do is how cooking stops being interesting.
 */
export function fitForCook(profile: CookProfile, demands: RecipeDemands): RecipeFit {
  const gaps: SkillGap[] = [];
  for (const skill of KITCHEN_SKILLS) {
    const needs = demands.skills?.[skill];
    if (!needs) continue;
    const has = assumedSkill(profile, skill);
    if (needs > has) gaps.push({ skill, needs, has });
  }
  gaps.sort((a, b) => b.needs - b.has - (a.needs - a.has));

  const kitchen = profile.stock ? toolsAtStock(profile.stock) : null;
  const missingTools = kitchen
    ? (demands.tools ?? []).filter(tool => !kitchen.has(tool))
    : [];

  const widest = gaps[0] ? gaps[0].needs - gaps[0].has : 0;
  const verdict: FitVerdict =
    widest >= 2 || missingTools.length > 0
      ? "challenge"
      : widest === 1
        ? "stretch"
        : "comfortable";

  return { verdict, gaps, missingTools, reason: reasonFor(verdict, gaps, missingTools) };
}

/** The sentence shown on a challenge. Names the thing, never scolds. */
function reasonFor(
  verdict: FitVerdict,
  gaps: readonly SkillGap[],
  missingTools: readonly string[],
): string | null {
  if (verdict === "comfortable") return null;

  const parts: string[] = [];
  if (gaps[0]) parts.push(`leans on ${KITCHEN_SKILL_LABEL[gaps[0].skill].toLowerCase()}`);
  if (missingTools.length === 1) parts.push(`wants a ${missingTools[0]}`);
  else if (missingTools.length > 1) {
    parts.push(`wants a ${missingTools.slice(0, -1).join(", a ")} and a ${missingTools.at(-1)}`);
  }

  if (parts.length === 0) return null;
  const body = parts.join(", and ");
  return verdict === "stretch" ? `A small step up: ${body}.` : `A challenge: this one ${body}.`;
}

// --- ordering ----------------------------------------------------------------

/**
 * Comfortable first, then stretches, then challenges - and nothing dropped.
 *
 * Ties keep whatever order they arrived in, so this layers on top of an
 * existing ranking (relevance, pantry matches, whatever else) instead of
 * replacing it.
 */
export function orderByFit<T>(
  items: readonly T[],
  profile: CookProfile,
  demandsOf: (item: T) => RecipeDemands,
): T[] {
  const weight: Record<FitVerdict, number> = { comfortable: 0, stretch: 1, challenge: 2 };
  return items
    .map((item, index) => ({ item, index, fit: fitForCook(profile, demandsOf(item)) }))
    .sort((a, b) => weight[a.fit.verdict] - weight[b.fit.verdict] || a.index - b.index)
    .map(x => x.item);
}

// --- time --------------------------------------------------------------------

/**
 * How long a step's hands-on work takes this particular cook.
 *
 * Only *active* time moves. A ten-minute simmer is ten minutes for everyone,
 * and stretching it because someone rated their knife work a 2 would ruin the
 * food - hands-off time is a property of the pot, not of the person holding
 * the spoon. Callers must keep the two apart.
 *
 * The multipliers are a guess, sized to be useful rather than precise, which
 * is why every surface showing this says "about".
 */
const PACE: Record<SkillLevel, number> = { 1: 1.6, 2: 1.25, 3: 1, 4: 0.9, 5: 0.85 };

export function activeSecondsFor(
  // Undefined as well as null: steps stored before these fields existed simply
  // do not carry them, and rows written by an older build must not turn into
  // NaN the moment a newer one reads them.
  step: { activeSeconds?: number | null; demands?: KitchenSkill | null },
  profile: CookProfile,
): number | null {
  if (step.activeSeconds === null || step.activeSeconds === undefined) return null;
  if (!step.demands) return step.activeSeconds;
  const pace = PACE[assumedSkill(profile, step.demands)];
  // To the nearest half minute. Second-level precision on an estimate is a lie
  // told in a confident voice.
  return Math.max(30, Math.round((step.activeSeconds * pace) / 30) * 30);
}

/** Hands-on plus hands-off, for a whole recipe, at this cook's pace. */
export function recipeMinutesFor(
  steps: readonly {
    activeSeconds?: number | null;
    timerSeconds?: number | null;
    demands?: KitchenSkill | null;
  }[],
  profile: CookProfile,
): number | null {
  if (steps.length === 0) return null;
  let seconds = 0;
  let known = false;
  for (const step of steps) {
    const active = activeSecondsFor(step, profile);
    if (active !== null) { seconds += active; known = true; }
    if (step.timerSeconds !== null && step.timerSeconds !== undefined) {
      seconds += step.timerSeconds;
      known = true;
    }
  }
  return known ? Math.round(seconds / 60) : null;
}

/**
 * Turn a recipe's free-text equipment list into tool names this can match.
 *
 * Import writes whatever the source page said - "9x13 baking dish", "Stand
 * Mixer (optional)" - so matching has to be forgiving. Anything unrecognised
 * is dropped rather than guessed at: a phantom requirement would tell someone
 * they cannot cook something they can, which is the expensive mistake here.
 */
export function canonicalTools(equipment: readonly string[]): string[] {
  const known = new Set<string>();
  for (const list of Object.values(STOCK_ADDS)) for (const tool of list) known.add(tool);

  const found = new Set<string>();
  for (const raw of equipment) {
    const text = raw.toLowerCase();
    // Optional equipment is exactly that, and must never gate a recipe.
    if (/optional/.test(text)) continue;
    for (const tool of known) {
      if (text.includes(tool)) found.add(tool);
    }
  }
  // "chef knife" implies "knife"; keep only what adds information.
  for (const tool of [...found]) {
    for (const other of found) {
      if (other !== tool && other.includes(tool)) found.delete(tool);
    }
  }
  return [...found].sort();
}
