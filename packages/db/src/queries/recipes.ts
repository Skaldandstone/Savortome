import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import {
  DEFAULT_LIBRARY_SORT,
  canonicalize,
  isStaple,
  isUuid,
  normalizeDraft,
  validateDraft,
  type LibrarySort,
  type Recipe,
  type RecipeDraft,
} from "@seconds/core";
import type { Database } from "../client.js";
import * as schema from "../schema.js";

/**
 * Persist a freshly extracted recipe and rebuild its ingredient index.
 * Re-importing the same source URL updates the existing card rather than
 * creating a second copy — people paste the same link twice all the time.
 */
export async function saveRecipe(
  database: Database,
  ownerId: string,
  recipe: Recipe,
): Promise<string> {
  const row = {
    ownerId,
    title: recipe.title,
    description: recipe.description,
    imageUrl: recipe.imageUrl,
    servings: recipe.servings,
    servingsNote: recipe.servingsNote,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    totalMinutes: recipe.totalMinutes,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    equipment: recipe.equipment,
    tags: recipe.tags,
    cuisine: recipe.cuisine,
    course: recipe.course,
    difficulty: recipe.difficulty,
    sourceKind: recipe.source.kind,
    sourceUrl: recipe.source.url,
    sourceAuthor: recipe.source.author,
    sourceSiteName: recipe.source.siteName,
    extractionMethod: recipe.source.extractionMethod,
    confidence: recipe.confidence,
    extractionNotes: recipe.extractionNotes,
    updatedAt: new Date(),
  } satisfies Partial<typeof schema.recipes.$inferInsert> & { ownerId: string };

  const [saved] = await database
    .insert(schema.recipes)
    .values(row)
    .onConflictDoUpdate({
      target: [schema.recipes.ownerId, schema.recipes.sourceUrl],
      // The unique index is partial, so Postgres needs its predicate here to
      // infer it as the arbiter. `setWhere` filters the UPDATE instead, which
      // leaves the conflict target unmatched and errors at runtime.
      targetWhere: sql`${schema.recipes.sourceUrl} is not null`,
      set: row,
    })
    .returning({ id: schema.recipes.id });

  const recipeId = saved!.id;
  await reindexIngredients(database, recipeId, recipe);
  return recipeId;
}

/**
 * A recipe someone typed themselves.
 *
 * No extraction happened, so there is nothing to be unsure about: confidence is
 * 1, there are no notes, and it counts as verified the moment it's saved.
 */
export async function createRecipe(
  database: Database,
  ownerId: string,
  draft: RecipeDraft,
): Promise<string> {
  const clean = normalizeDraft(draft);
  validateDraft(clean);

  const [saved] = await database
    .insert(schema.recipes)
    .values({
      ownerId,
      ...draftColumns(clean),
      sourceKind: "manual",
      extractionMethod: "manual",
      confidence: 1,
      extractionNotes: [],
      verifiedAt: new Date(),
    })
    .returning({ id: schema.recipes.id });

  const recipeId = saved!.id;
  await reindexIngredients(database, recipeId, { ingredients: clean.ingredients } as Recipe);
  return recipeId;
}

/**
 * Save corrections to a recipe.
 *
 * Editing an imported card marks it verified: the confidence score and the list
 * of things the extractor had to guess stay on the record, but they stop being
 * a warning, because someone has now read it. Where the recipe came from is
 * left alone — a corrected import is still an import, and the attribution is
 * the honest part of it.
 */
export async function updateRecipe(
  database: Database,
  ownerId: string,
  recipeId: string,
  draft: RecipeDraft,
): Promise<boolean> {
  const clean = normalizeDraft(draft);
  validateDraft(clean);

  const [updated] = await database
    .update(schema.recipes)
    .set({ ...draftColumns(clean), verifiedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(schema.recipes.id, recipeId), eq(schema.recipes.ownerId, ownerId)))
    .returning({ id: schema.recipes.id });

  if (!updated) return false;

  // The ingredient index is derived from what was just written, so it has to be
  // rebuilt in the same breath or pantry search answers from the old card.
  await reindexIngredients(database, recipeId, { ingredients: clean.ingredients } as Recipe);
  return true;
}

/** Throw away a recipe. Everything hanging off it goes with it, by cascade. */
export async function deleteRecipe(
  database: Database,
  ownerId: string,
  recipeId: string,
): Promise<boolean> {
  const [deleted] = await database
    .delete(schema.recipes)
    .where(and(eq(schema.recipes.id, recipeId), eq(schema.recipes.ownerId, ownerId)))
    .returning({ id: schema.recipes.id });
  return Boolean(deleted);
}

/** The columns a draft owns — everything except provenance and ownership. */
function draftColumns(draft: RecipeDraft) {
  return {
    title: draft.title,
    description: draft.description,
    imageUrl: draft.imageUrl,
    servings: draft.servings,
    servingsNote: draft.servingsNote,
    prepMinutes: draft.prepMinutes,
    cookMinutes: draft.cookMinutes,
    totalMinutes: draft.totalMinutes,
    ingredients: draft.ingredients,
    steps: draft.steps,
    equipment: draft.equipment,
    tags: draft.tags,
    cuisine: draft.cuisine,
    course: draft.course,
    difficulty: draft.difficulty,
  };
}

/** Rebuild the flattened ingredient rows that pantry search will join against. */
async function reindexIngredients(
  database: Database,
  recipeId: string,
  recipe: Recipe,
): Promise<void> {
  // Two lines can share a canonical item ("garlic" whole and minced); the index
  // holds one row per item, so collapse before inserting.
  const byItem = new Map<string, { optional: boolean }>();
  for (const ing of recipe.ingredients) {
    const key = ing.canonicalItem.trim();
    if (!key) continue;
    const existing = byItem.get(key);
    byItem.set(key, { optional: (existing?.optional ?? true) && ing.optional });
  }

  const clear = database
    .delete(schema.recipeIngredients)
    .where(eq(schema.recipeIngredients.recipeId, recipeId));

  if (byItem.size === 0) {
    await clear;
    return;
  }

  await database.batch([
    clear,
    database.insert(schema.recipeIngredients).values(
      [...byItem].map(([canonicalItem, { optional }]) => ({
        recipeId,
        canonicalItem,
        optional,
        isStaple: isStaple(canonicalItem),
      })),
    ),
  ]);
}

export interface ListRecipesOptions {
  limit?: number;
  /** Restrict to these ids, in this order. Used when filtering by shelf. */
  ids?: string[];
  /** Free text. Matches the name, cuisine, description, tags, and ingredients. */
  query?: string;
  /**
   * How to order the result. Omitted alongside `ids` keeps the caller's order,
   * which is what a search wants — its ids arrive ranked by relevance.
   */
  sort?: LibrarySort;
}

/** The signed-in user's recipes, newest first. */
/**
 * The signed-in user's library.
 *
 * The rating is joined in rather than fetched afterwards: the card wants to
 * show it, and two of the sorts order by it, so a separate round trip would be
 * paying twice for the same row. It's a left join — an unrated recipe is the
 * common case, not a missing one.
 */
export async function listRecipes(
  database: Database,
  ownerId: string,
  options: ListRecipesOptions = {},
) {
  const { limit = 50, ids, sort } = options;
  if (ids && ids.length === 0) return [];

  const rows = await database
    .select({
      id: schema.recipes.id,
      title: schema.recipes.title,
      imageUrl: schema.recipes.imageUrl,
      totalMinutes: schema.recipes.totalMinutes,
      ingredients: schema.recipes.ingredients,
      sourceAuthor: schema.recipes.sourceAuthor,
      sourceSiteName: schema.recipes.sourceSiteName,
      sourceKind: schema.recipes.sourceKind,
      visibility: schema.recipes.visibility,
      createdAt: schema.recipes.createdAt,
      stars: schema.ratings.stars,
      timesCooked: schema.ratings.timesCooked,
      lastCookedAt: schema.ratings.lastCookedAt,
    })
    .from(schema.recipes)
    .leftJoin(
      schema.ratings,
      and(
        eq(schema.ratings.recipeId, schema.recipes.id),
        eq(schema.ratings.userId, ownerId),
      ),
    )
    .where(
      and(
        eq(schema.recipes.ownerId, ownerId),
        ids ? inArray(schema.recipes.id, ids) : undefined,
      ),
    )
    .orderBy(...orderFor(sort))
    .limit(limit);

  // No sort asked for, but a caller-supplied order to honour: shelves order by
  // when a recipe was added, and a search arrives ranked by relevance.
  if (ids && !sort) {
    const rank = new Map(ids.map((id, i) => [id, i]));
    return rows.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
  }
  return rows;
}

/**
 * Nulls always sort last, whichever direction the column runs.
 *
 * A recipe with no cook time or no rating is the least useful answer to
 * "quickest" or "best rated" — floating it to the top because null happens to
 * sort high in Postgres would be a bug that looks like a preference.
 */
function orderFor(sort: LibrarySort | undefined): SQL[] {
  const newest = sql`${schema.recipes.createdAt} desc`;

  switch (sort ?? DEFAULT_LIBRARY_SORT) {
    case "name":
      return [sql`lower(${schema.recipes.title}) asc`];
    case "quickest":
      return [sql`${schema.recipes.totalMinutes} asc nulls last`, newest];
    case "rated":
      return [sql`${schema.ratings.stars} desc nulls last`, newest];
    case "cooked":
      return [sql`${schema.ratings.lastCookedAt} desc nulls last`, newest];
    default:
      return [newest];
  }
}

/**
 * Search your own recipes.
 *
 * Discovery searches what other people have shared; this searches what you
 * kept. Three ways in, because people look for a saved recipe by all three and
 * remember only one of them:
 *
 * - the **words on the card** — name, cuisine, description — through the same
 *   generated tsvector discovery uses, so the title outranks a passing mention;
 * - a **tag**, matched exactly rather than stemmed, because "vegetarian" means
 *   vegetarian;
 * - an **ingredient**, through the canonical index the pantry already joins on,
 *   which is the one discovery can't do and the one that answers "what did I
 *   make with gochujang".
 *
 * Any of the three is a hit. Full-text rank orders what it can and the rest
 * falls back to newest first, which is the order the library already uses.
 */
export async function searchRecipes(
  database: Database,
  ownerId: string,
  query: string,
  limit = 50,
): Promise<string[]> {
  const text = query.trim();
  if (!text) return [];

  const tsquery = sql`websearch_to_tsquery('english'::regconfig, ${text})`;
  // Ingredient and tag matching are literal, not stemmed — someone typing
  // "gochujang" wants that jar, not something merely near it.
  const term = text.toLowerCase();

  const rows = await database
    .select({
      id: schema.recipes.id,
      rank: sql<number>`ts_rank(${schema.recipes.searchVector}, ${tsquery})`.as("rank"),
      createdAt: schema.recipes.createdAt,
    })
    .from(schema.recipes)
    .where(
      and(
        eq(schema.recipes.ownerId, ownerId),
        sql`(
          ${schema.recipes.searchVector} @@ ${tsquery}
          or exists (
            select 1 from unnest(${schema.recipes.tags}) as tag
            where tag = ${term}
          )
          or exists (
            select 1 from ${schema.recipeIngredients} ri
            where ri.recipe_id = ${schema.recipes.id}
              and ri.canonical_item like ${`%${term}%`}
          )
        )`,
      ),
    )
    .orderBy(desc(sql`rank`), desc(schema.recipes.createdAt))
    .limit(limit);

  return rows.map((row) => row.id);
}

export async function getRecipe(database: Database, ownerId: string, recipeId: string) {
  // Same reasoning as recipeIdsOnShelf: /recipe/<nonsense> should be a 404,
  // not a raised Postgres error carrying the query with it.
  if (!isUuid(recipeId)) return undefined;

  return database.query.recipes.findFirst({
    where: and(eq(schema.recipes.id, recipeId), eq(schema.recipes.ownerId, ownerId)),
  });
}

/** How many recipes someone owns, unfiltered and unpaged. */
export async function countRecipes(database: Database, ownerId: string): Promise<number> {
  const [row] = await database
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.recipes)
    .where(eq(schema.recipes.ownerId, ownerId));
  return row?.n ?? 0;
}

/**
 * Every recipe someone owns, whole.
 *
 * `listRecipes` returns the summary a shelf needs; this returns the full rows,
 * because an export that dropped the method would be a list of titles rather
 * than an archive. Unpaged on purpose — a personal recipe collection is small,
 * and half an archive is worse than none.
 */
export async function allRecipesFor(database: Database, ownerId: string) {
  return database.query.recipes.findMany({
    where: eq(schema.recipes.ownerId, ownerId),
    orderBy: (r, { asc }) => [asc(r.title)],
  });
}

/**
 * Recompute every stored recipe's canonical ingredient names and rebuild the
 * ingredient index.
 *
 * The canonicalizer is code, and improving it — teaching it a new prep word, a
 * new way recipes phrase alternatives — changes what a recipe's key should be.
 * Without this, those improvements only reach recipes imported afterwards, and
 * the pantry silently keeps missing the older ones.
 */
export async function recanonicalizeRecipes(
  database: Database,
  ownerId: string,
): Promise<{ recipes: number; changed: number }> {
  const rows = await database.query.recipes.findMany({
    where: eq(schema.recipes.ownerId, ownerId),
    columns: { id: true, ingredients: true },
  });

  let changed = 0;

  for (const row of rows) {
    const ingredients = row.ingredients.map((ing) => ({
      ...ing,
      canonicalItem: canonicalize(ing.item || ing.raw),
    }));

    const differs = ingredients.some(
      (ing, i) => ing.canonicalItem !== row.ingredients[i]?.canonicalItem,
    );
    if (!differs) continue;

    changed++;
    await database
      .update(schema.recipes)
      .set({ ingredients, updatedAt: new Date() })
      .where(eq(schema.recipes.id, row.id));

    await reindexIngredients(database, row.id, { ingredients } as Recipe);
  }

  return { recipes: rows.length, changed };
}
