import { eq } from "drizzle-orm";
import {
  COOK_TIERS,
  skillRatingsFrom,
  KITCHEN_SKILLS,
  KITCHEN_STOCKS,
  SKILL_LEVELS,
  type CookProfile,
  type CookTier,
  type KitchenSkill,
  type KitchenStock,
  type SkillDemands,
  type SkillLevel,
  type SkillRatings,
} from "@seconds/core";
import type { Database } from "../client.js";
import * as schema from "../schema.js";

/**
 * Reading and writing what a cook says they can manage.
 *
 * Every field is optional and stays optional. The tier is one tap on first
 * visit to the cook section; the skills and the kitchen are offered afterwards
 * and can be skipped for good. So an empty profile is a perfectly normal
 * answer, not a half-finished one, and nothing here should ever be written in
 * a way that implies otherwise.
 *
 * None of this is used by the care experience. See the fence in
 * `packages/core/test/cooking-skill.test.ts`.
 */

/**
 * Anything stored is checked on the way back out.
 *
 * These columns are text and JSONB, so a value written by an older build, a
 * renamed tier, or a hand-edited row can all put something unexpected in them.
 * An unrecognised value reads as "not said" rather than throwing: a bad tier
 * should cost someone their ranking preference, not the page.
 */
function readTier(value: unknown): CookTier | undefined {
  return COOK_TIERS.includes(value as CookTier) ? (value as CookTier) : undefined;
}

function readStock(value: unknown): KitchenStock | undefined {
  return KITCHEN_STOCKS.includes(value as KitchenStock) ? (value as KitchenStock) : undefined;
}

function readSkills(value: unknown): SkillRatings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: SkillRatings = {};
  for (const skill of KITCHEN_SKILLS) {
    const level = (value as Record<string, unknown>)[skill];
    if (SKILL_LEVELS.includes(level as SkillLevel)) out[skill] = level as SkillLevel;
  }
  return out;
}

/** The profile for one account. Empty when they have not answered anything. */
export async function getCookProfile(
  database: Database,
  userId: string,
): Promise<CookProfile> {
  const row = await database.query.users.findFirst({
    where: eq(schema.users.id, userId),
    columns: { cookTier: true, cookSkills: true, kitchenStock: true },
  });
  if (!row) return {};

  const skills = readSkills(row.cookSkills);
  return {
    ...(readTier(row.cookTier) ? { tier: readTier(row.cookTier) } : {}),
    ...(readStock(row.kitchenStock) ? { stock: readStock(row.kitchenStock) } : {}),
    ...(Object.keys(skills).length > 0 ? { skills } : {}),
  };
}

/**
 * Update whichever parts of the profile were actually answered.
 *
 * Absent means "leave it alone"; explicit null means "clear it". Those have to
 * be different, because the onboarding saves the tier before the other two
 * questions are asked, and a plain merge would then wipe answers given later.
 *
 * Individual skill ratings merge rather than replace, so rating knife work
 * today does not silently erase the baking answer given last week.
 */
export async function saveCookProfile(
  database: Database,
  userId: string,
  update: {
    tier?: CookTier | null;
    stock?: KitchenStock | null;
    skills?: SkillRatings | null;
  },
): Promise<CookProfile> {
  const patch: Partial<typeof schema.users.$inferInsert> = {};

  if (update.tier !== undefined) patch.cookTier = update.tier;
  if (update.stock !== undefined) patch.kitchenStock = update.stock;

  if (update.skills === null) {
    patch.cookSkills = {};
  } else if (update.skills !== undefined) {
    const current = await getCookProfile(database, userId);
    patch.cookSkills = { ...current.skills, ...readSkills(update.skills) };
  }

  // Nothing to do rather than an empty UPDATE touching the row for no reason.
  if (Object.keys(patch).length === 0) return getCookProfile(database, userId);

  await database.update(schema.users).set(patch).where(eq(schema.users.id, userId));
  return getCookProfile(database, userId);
}

/**
 * What a recipe asks of a cook, in the shape `fitForCook` wants.
 *
 * Tools come from the recipe's existing free-text `equipment` list rather than
 * a second column holding the same information; the caller canonicalises it.
 */
export async function getRecipeDemands(
  database: Database,
  recipeId: string,
): Promise<{ skills: SkillRatings; equipment: readonly string[] } | null> {
  const row = await database.query.recipes.findFirst({
    where: eq(schema.recipes.id, recipeId),
    columns: { skillDemands: true, equipment: true },
  });
  if (!row) return null;
  // A null column means this recipe has never been analysed, which is a
  // different thing from analysed and found to ask nothing in particular.
  return { skills: skillRatingsFrom(row.skillDemands), equipment: row.equipment ?? [] };
}

/**
 * Record what an import worked out about a recipe.
 *
 * Kept separate from `saveRecipe` on purpose: analysis can run later, or be
 * re-run over recipes imported before any of this existed, without touching
 * the card itself or disturbing a re-import.
 */
export async function saveRecipeDemands(
  database: Database,
  recipeId: string,
  skills: SkillRatings,
): Promise<void> {
  // Stored with every key present, so "not analysed" (a null column) stays
  // distinguishable from "analysed, asks nothing of your knife work".
  const demands: SkillDemands = {
    knife: skills.knife ?? null,
    stovetop: skills.stovetop ?? null,
    oven: skills.oven ?? null,
    timing: skills.timing ?? null,
  };
  await database
    .update(schema.recipes)
    .set({ skillDemands: demands })
    .where(eq(schema.recipes.id, recipeId));
}

/** Which skill each step leans on, for pacing. Keyed by step number. */
export type StepDemands = Map<number, KitchenSkill | null>;
