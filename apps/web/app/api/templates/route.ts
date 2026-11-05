import { parseMealTemplateCreate } from "@seconds/core";
import { createTemplate, listTemplates } from "@seconds/db";
import { BadRequestError, withUser } from "@/lib/api";
import { boundedJson } from "@/lib/bounded-json";

export const runtime = "nodejs";

/** Your saved meals — a main plus whichever side, drink, and dessert go with it. */
export async function GET() {
  const response = await withUser(async (userId, database) => ({ templates: await listTemplates(database, userId) }), { redactUnexpectedErrors: true });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

/** Save the current pick of dishes as a named, reusable meal. */
export async function POST(request: Request) {
  const response = await withUser(async (userId, database) => {
    const body = await boundedJson(request, 4096);
    let input;
    try { input = parseMealTemplateCreate(body); }
    catch { throw new BadRequestError("Review a meal name (up to 160 characters), one to four saved dishes with distinct roles, and an optional valid request ID."); }
    const id = await createTemplate(database, userId, input.name, input.items, input.id);
    return { id };
  }, { redactUnexpectedErrors: true });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
