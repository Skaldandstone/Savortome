import { parsePantryIntake, parsePantryIntakeResolution } from "@seconds/core";
import { createPantryIntake, listPantry, listPendingPantryIntakes, resolvePantryIntake } from "@seconds/db";
import { readJson, withUser } from "@/lib/api";

export const runtime = "nodejs";

export async function GET() {
  return withUser((userId, database) => listPendingPantryIntakes(database, userId));
}

/**
 * Authenticated application intake only. Provider webhooks need their own raw
 * signature verification and may call this domain layer after verification.
 */
export async function POST(request: Request) {
  const body = await readJson<Record<string, unknown>>(request);
  return withUser((userId, database) => createPantryIntake(database, userId, parsePantryIntake(body)));
}

export async function PATCH(request: Request) {
  const body = await readJson<Record<string, unknown>>(request);
  return withUser(async (userId, database) => {
    const resolution = parsePantryIntakeResolution(body);
    await resolvePantryIntake(database, userId, resolution);
    return {
      pantry: await listPantry(database, userId),
      intakes: await listPendingPantryIntakes(database, userId),
    };
  });
}
