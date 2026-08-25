import { and, desc, eq, ne, sql } from "drizzle-orm";
import type { Database } from "../client.js";
import * as schema from "../schema.js";

/**
 * Finding recipes you don't already have.
 *
 * Deliberately not embeddings. Recipes are short, structured documents whose
 * useful similarity is concrete — shared ingredients, shared tags, same
 * cuisine — and a result you can explain ("shares 6 ingredients") is worth more
 * to a cook than a cosine score they can't argue with. Postgres full-text and
 * array overlap do that with no extra service. `recipes.embedding` is still
 * there for when semantic search earns its keep.
 */

export interface DiscoverCard {
  recipeId: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  totalMinutes: number | null;
  tags: string[];
  cuisine: string | null;
  sharedBy: { handle: string; displayName: string; avatarUrl: string | null };
  saveCount: number;
  /** Why this is in front of you. Empty on the plain feed. */
  reason?: string;
}

const CARD_COLUMNS = {
  recipeId: schema.recipes.id,
  title: schema.recipes.title,
  description: schema.recipes.description,
  imageUrl: schema.recipes.imageUrl,
  totalMinutes: schema.recipes.totalMinutes,
  tags: schema.recipes.tags,
  cuisine: schema.recipes.cuisine,
  handle: schema.users.handle,
  displayName: schema.users.displayName,
  avatarUrl: schema.users.avatarUrl,
  saveCount: sql<number>`(
    select count(*)::int from ${schema.recipes} copies
    where copies.copied_from_id = ${schema.recipes.id}
  )`.as("save_count"),
};

type CardRow = {
  recipeId: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  totalMinutes: number | null;
  tags: string[];
  cuisine: string | null;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  saveCount: number;
};

const toCard = (row: CardRow, reason?: string): DiscoverCard => ({
  recipeId: row.recipeId,
  title: row.title,
  description: row.description,
  imageUrl: row.imageUrl,
  totalMinutes: row.totalMinutes,
  tags: row.tags,
  cuisine: row.cuisine,
  sharedBy: {
    handle: row.handle,
    displayName: row.displayName,
    avatarUrl: row.avatarUrl,
  },
  saveCount: row.saveCount,
  ...(reason ? { reason } : {}),
});

/**
 * Only ever public recipes, and never the viewer's own — discovery is for
 * finding what you don't have. Friends-only recipes stay out of here on
 * purpose; they reach their audience through the feed.
 */
function publicAndNotMine(viewerId: string | null) {
  const isPublic = eq(schema.recipes.visibility, "public");
  return viewerId ? and(isPublic, ne(schema.recipes.ownerId, viewerId)) : isPublic;
}

export interface DiscoverFilters {
  /** Free text over title, cuisine, and description. */
  query?: string;
  /** Recipe must carry at least one of these tags. */
  tags?: string[];
  maxMinutes?: number | null;
  limit?: number;
}

/**
 * The browse feed: most-saved first, newest as the tiebreak.
 *
 * Saves are a better signal than ratings here — someone bothering to put a
 * recipe into their own collection says more than a star they clicked once.
 */
export async function discoverFeed(
  database: Database,
  viewerId: string | null,
  filters: DiscoverFilters = {},
): Promise<DiscoverCard[]> {
  const { tags = [], maxMinutes = null, limit = 30 } = filters;

  const rows = await database
    .select(CARD_COLUMNS)
    .from(schema.recipes)
    .innerJoin(schema.users, eq(schema.users.id, schema.recipes.ownerId))
    .where(
      and(
        publicAndNotMine(viewerId),
        tags.length > 0 ? sql`${schema.recipes.tags} && ${sql.param(tags)}::text[]` : undefined,
        maxMinutes !== null
          ? sql`(${schema.recipes.totalMinutes} is null or ${schema.recipes.totalMinutes} <= ${maxMinutes})`
          : undefined,
      ),
    )
    .orderBy(desc(sql`save_count`), desc(schema.recipes.sharedAt))
    .limit(limit);

  return rows.map((row) => toCard(row as CardRow));
}

/**
 * Full-text search over shared recipes.
 *
 * `websearch_to_tsquery` is the forgiving parser — it takes what a person types,
 * quoted phrases and `-exclusions` included, without erroring on stray
 * punctuation the way `to_tsquery` does.
 */
export async function searchDiscover(
  database: Database,
  viewerId: string | null,
  filters: DiscoverFilters = {},
): Promise<DiscoverCard[]> {
  const { query = "", tags = [], maxMinutes = null, limit = 30 } = filters;
  const text = query.trim();
  if (!text) return discoverFeed(database, viewerId, filters);

  const tsquery = sql`websearch_to_tsquery('english'::regconfig, ${text})`;

  const rows = await database
    .select({
      ...CARD_COLUMNS,
      rank: sql<number>`ts_rank(${schema.recipes.searchVector}, ${tsquery})`.as("rank"),
    })
    .from(schema.recipes)
    .innerJoin(schema.users, eq(schema.users.id, schema.recipes.ownerId))
    .where(
      and(
        publicAndNotMine(viewerId),
        sql`${schema.recipes.searchVector} @@ ${tsquery}`,
        tags.length > 0 ? sql`${schema.recipes.tags} && ${sql.param(tags)}::text[]` : undefined,
        maxMinutes !== null
          ? sql`(${schema.recipes.totalMinutes} is null or ${schema.recipes.totalMinutes} <= ${maxMinutes})`
          : undefined,
      ),
    )
    // Relevance first, then how many people kept it.
    .orderBy(desc(sql`rank`), desc(sql`save_count`))
    .limit(limit);

  return rows.map((row) => toCard(row as CardRow));
}

/**
 * "More like this", by what the recipes are actually made of.
 *
 * Shared non-staple ingredients carry the weight — two recipes both using miso
 * and gochujang are related in a way that matters — with shared tags as a
 * lighter signal. The overlap count becomes the reason shown to the reader.
 */
export async function similarRecipes(
  database: Database,
  recipeId: string,
  viewerId: string | null,
  limit = 6,
): Promise<DiscoverCard[]> {
  const source = await database.query.recipes.findFirst({
    where: eq(schema.recipes.id, recipeId),
    columns: { id: true, tags: true },
  });
  if (!source) return [];

  const rows = await database
    .select({
      ...CARD_COLUMNS,
      sharedIngredients: sql<number>`(
        select count(*)::int
        from ${schema.recipeIngredients} mine
        join ${schema.recipeIngredients} theirs
          on theirs.canonical_item = mine.canonical_item
        where mine.recipe_id = ${recipeId}
          and theirs.recipe_id = ${schema.recipes.id}
          and mine.is_staple = false
      )`.as("shared_ingredients"),
      sharedTags: sql<number>`coalesce(array_length(
        array(select unnest(${schema.recipes.tags}) intersect select unnest(${sql.param(source.tags)}::text[])),
        1
      ), 0)`.as("shared_tags"),
    })
    .from(schema.recipes)
    .innerJoin(schema.users, eq(schema.users.id, schema.recipes.ownerId))
    .where(and(publicAndNotMine(viewerId), ne(schema.recipes.id, recipeId)))
    .orderBy(desc(sql`shared_ingredients`), desc(sql`shared_tags`), desc(sql`save_count`))
    .limit(limit);

  return rows
    // Nothing in common isn't "similar", it's just the next row in the table.
    .filter((row) => Number(row.sharedIngredients) > 0 || Number(row.sharedTags) > 0)
    .map((row) => {
      const ingredients = Number(row.sharedIngredients);
      const tags = Number(row.sharedTags);
      const reason =
        ingredients > 0
          ? `Shares ${ingredients} ingredient${ingredients === 1 ? "" : "s"}`
          : `Also ${tags === 1 ? "tagged the same" : `shares ${tags} tags`}`;
      return toCard(row as CardRow, reason);
    });
}

/** Tags in use across shared recipes, most common first — the browse chips. */
export async function popularTags(
  database: Database,
  viewerId: string | null,
  limit = 16,
): Promise<{ tag: string; count: number }[]> {
  const rows = await database
    .select({
      tag: sql<string>`tag`.as("tag"),
      count: sql<number>`count(*)::int`.as("count"),
    })
    .from(
      sql`(
        select unnest(${schema.recipes.tags}) as tag
        from ${schema.recipes}
        where ${publicAndNotMine(viewerId)}
      ) tags`,
    )
    .groupBy(sql`tag`)
    .orderBy(desc(sql`count`))
    .limit(limit);

  return rows;
}
