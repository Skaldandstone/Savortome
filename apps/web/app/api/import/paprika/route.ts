import { NextResponse } from "next/server";
import { ingestDocument, paprikaSource, parsePaprikaExport } from "@seconds/core";
import { ensureInitialStatus, saveRecipe, spendCredit } from "@seconds/db";
import { BadRequestError, withUser } from "@/lib/api";

/**
 * Bulk-imports a Paprika Recipe Manager export (`.paprikarecipes`). Unlike
 * `/api/import`, this creates many recipes from one request — it never calls
 * a model (every field is already structured, same reasoning as a page's own
 * schema.org data), so it never touches the credit meter beyond the
 * always-free `spendCredit` no-op.
 */
export const runtime = "nodejs";

// Not a real limit on library size — a guard against one oversized or
// adversarial file turning into an unbounded loop of database writes.
const MAX_FILE_BYTES = 200_000_000;
const MAX_IMPORT_RECIPES = 500;

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Send a .paprikarecipes file." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "That export is too large to import at once." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  return withUser(async (userId, database) => {
    let parsed;
    try {
      parsed = parsePaprikaExport(buffer);
    } catch (err) {
      throw new BadRequestError(err instanceof Error ? err.message : "Couldn't read that file.");
    }

    const items = parsed.items.slice(0, MAX_IMPORT_RECIPES);
    const overflow = parsed.items.length - items.length;

    let imported = 0;
    const failedTitles: string[] = [];
    for (const item of items) {
      try {
        const { recipe } = await ingestDocument(paprikaSource(item));
        const savedId = await saveRecipe(database, userId, recipe);
        await ensureInitialStatus(database, userId, savedId, "want_to_cook");
        // Always a no-op cost-wise (file-import is free) — called for the
        // same reason the single-recipe importer calls it unconditionally:
        // one place decides what an extraction costs, and this isn't it.
        await spendCredit(database, userId, "file-import", savedId);
        imported++;
      } catch {
        failedTitles.push(item.recipe.title);
      }
    }

    return {
      imported,
      skipped: parsed.skipped.length,
      failed: failedTitles.length,
      failedTitles: failedTitles.slice(0, 20),
      overflow,
    };
  });
}

