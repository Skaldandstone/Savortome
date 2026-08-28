import type { TemplateRole } from "@seconds/core";
import { createTemplate, listTemplates } from "@seconds/db";
import { readJson, withUser } from "@/lib/api";

export const runtime = "nodejs";

/** Your saved meals — a main plus whichever side, drink, and dessert go with it. */
export async function GET() {
  return withUser(async (userId, database) => ({ templates: await listTemplates(database, userId) }));
}

interface Body {
  name: string;
  items: { role: TemplateRole; recipeId: string }[];
}

/** Save the current pick of dishes as a named, reusable meal. */
export async function POST(request: Request) {
  const body = await readJson<Body>(request);

  return withUser(async (userId, database) => {
    const id = await createTemplate(database, userId, body.name ?? "", body.items ?? []);
    return { id };
  });
}
