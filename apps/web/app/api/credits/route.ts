import { creditsFor } from "@seconds/db";
import { CREDIT_PACKS, nextResetISO } from "@seconds/core";
import { withUser } from "@/lib/api";

/**
 * What's left, and what the tiers cost.
 *
 * Read on the import screen so someone knows where they stand before pasting a
 * link, rather than finding out when it's refused.
 */
export const runtime = "nodejs";

export async function GET() {
  return withUser(async (userId, database) => ({
    credits: await creditsFor(database, userId),
    resetsOn: nextResetISO(),
    packs: CREDIT_PACKS,
  }));
}
