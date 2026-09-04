import { NextResponse } from "next/server";
import { ingestDocument, paprikaSource, parsePaprikaExport, type PaprikaImportItem } from "@seconds/core";
import { ensureInitialStatus, saveRecipe, spendCredit, type Database } from "@seconds/db";
import { BadRequestError, withUser } from "@/lib/api";

/**
 * Bulk-imports a Paprika Recipe Manager export (`.paprikarecipes`). Unlike
 * `/api/import`, this creates many recipes from one request — it never calls
 * a model (every field is already structured, same reasoning as a page's own
 * schema.org data), so it never touches the credit meter beyond the
 * always-free `spendCredit` no-op.
 */
export const runtime = "nodejs";
// Up to 500 recipes, each doing a couple of DB round trips even at
// CONCURRENCY-wide overlap — matches the single-recipe importer's own
// allowance for the same reason: a slow import shouldn't hit a short
// platform default and fail partway through.
export const maxDuration = 300;

// Not a real limit on library size — a guard against one oversized or
// adversarial file turning into an unbounded loop of database writes.
const MAX_FILE_BYTES = 200_000_000;
const MAX_IMPORT_RECIPES = 500;
// Every recipe's save is independent (its own row, its own shelf-status
// row), so there's no correctness reason to run them one at a time — only
// bounded to avoid opening hundreds of DB connections/transactions at once.
const CONCURRENCY = 10;

async function importOne(database: Database, userId: string, item: PaprikaImportItem): Promise<boolean> {
  try {
    const { recipe } = await ingestDocument(paprikaSource(item));
    const savedId = await saveRecipe(database, userId, recipe);
    await ensureInitialStatus(database, userId, savedId, "want_to_cook");
    // Always a no-op cost-wise (file-import is free) — called for the same
    // reason the single-recipe importer calls it unconditionally: one place
    // decides what an extraction costs, and this isn't it.
    await spendCredit(database, userId, "file-import", savedId);
    return true;
  } catch (err) {
    console.error(`Paprika import: failed to save "${item.recipe.title}"`, err);
    return false;
  }
}

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

    let failed = 0;
    for (let i = 0; i < items.length; i += CONCURRENCY) {
      const chunk = items.slice(i, i + CONCURRENCY);
      const results = await Promise.all(chunk.map((item) => importOne(database, userId, item)));
      failed += results.filter((ok) => !ok).length;
    }

    return {
      imported: items.length - failed,
      skipped: parsed.skipped.length,
      failed,
      overflow,
    };
  });
}

