import {
  COOK_TIERS,
  KITCHEN_SKILLS,
  KITCHEN_STOCKS,
  SKILL_LEVELS,
  type CookTier,
  type KitchenStock,
  type SkillLevel,
  type SkillRatings,
} from "@seconds/core";
import { getCookProfile, saveCookProfile } from "@seconds/db";
import { readJson, withUser } from "@/lib/api";

export const runtime = "nodejs";

/**
 * What this cook says they can manage.
 *
 * Every part is optional and stays optional: the tier is one tap on first
 * visit to the cook section, and the skills and kitchen can be skipped for
 * good. So an empty answer here is a complete answer, not a half-finished one.
 */
export async function GET() {
  return withUser((userId, database) => getCookProfile(database, userId));
}

/**
 * Save whichever parts were answered.
 *
 * Absent means "leave it alone" and explicit null means "clear it", which is
 * the distinction the onboarding relies on: it saves the tier before the other
 * two questions are even asked, and a plain merge would then wipe whatever was
 * answered afterwards.
 *
 * Anything unrecognised is dropped rather than rejected. A stale client
 * sending a renamed tier should cost that person a ranking preference, not
 * their whole answer.
 */
export async function PATCH(request: Request) {
  const body = await readJson<{
    tier?: unknown;
    stock?: unknown;
    skills?: unknown;
  }>(request);

  const update: {
    tier?: CookTier | null;
    stock?: KitchenStock | null;
    skills?: SkillRatings | null;
  } = {};

  if (body.tier === null) update.tier = null;
  else if (COOK_TIERS.includes(body.tier as CookTier)) update.tier = body.tier as CookTier;

  if (body.stock === null) update.stock = null;
  else if (KITCHEN_STOCKS.includes(body.stock as KitchenStock)) {
    update.stock = body.stock as KitchenStock;
  }

  if (body.skills === null) update.skills = null;
  else if (body.skills && typeof body.skills === "object" && !Array.isArray(body.skills)) {
    const skills: SkillRatings = {};
    for (const skill of KITCHEN_SKILLS) {
      const level = (body.skills as Record<string, unknown>)[skill];
      if (SKILL_LEVELS.includes(level as SkillLevel)) skills[skill] = level as SkillLevel;
    }
    update.skills = skills;
  }

  return withUser((userId, database) => saveCookProfile(database, userId, update));
}
