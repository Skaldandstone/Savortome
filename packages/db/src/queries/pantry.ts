import { and, eq, inArray, sql } from "drizzle-orm";
import {
  STAPLE_ITEMS,
  rankMatches,
  type PantryEntry,
  type PantryEntryUpdate,
  type PantryMatch,
} from "@seconds/core";
import type { Database } from "../client.js";
import * as schema from "../schema.js";

/**
 * The pantry, and the query behind "what can I make from what I have".
 *
 * The staple list is code, not data, so it is passed into the query as a
 * parameter rather than read from `recipe_ingredients.is_staple`. Editing the
 * list then takes effect immediately instead of needing every recipe
 * reindexed — the stored column stays as a convenience for display.
 */

const STAPLES = [...STAPLE_ITEMS];

// ---------------------------------------------------------------- the pantry

export async function listPantry(database: Database, userId: string): Promise<PantryEntry[]> {
  const rows = await database.query.pantryItems.findMany({
    where: eq(schema.pantryItems.userId, userId),
    orderBy: (p, { asc }) => [asc(p.displayName)],
  });

  return rows.map((r) => ({
    canonicalItem: r.canonicalItem,
    displayName: r.displayName,
    quantity: r.quantity,
    unit: r.unit,
    isStaple: r.isStaple,
    isUsual: r.isUsual,
    storageLocation: r.storageLocation as PantryEntry["storageLocation"],
    acquiredAt: r.acquiredAt?.toISOString() ?? null,
    lastConfirmedAt: r.lastConfirmedAt?.toISOString() ?? null,
    source: r.source as PantryEntry["source"],
    confidence: r.confidence as PantryEntry["confidence"],
    updatedAt: r.updatedAt.toISOString(),
  }));
}

/** Add entries, replacing any that share a canonical item. */
export async function addPantryItems(
  database: Database,
  userId: string,
  entries: PantryEntry[],
): Promise<PantryEntry[]> {
  if (entries.length > 0) {
    const now = new Date();
    await database
      .insert(schema.pantryItems)
      .values(
        entries.map((e) => ({
          userId,
          canonicalItem: e.canonicalItem,
          displayName: e.displayName,
          quantity: e.quantity,
          unit: e.unit,
          isStaple: e.isStaple,
          isUsual: e.isUsual ?? false,
          storageLocation: e.storageLocation ?? "unknown",
          acquiredAt: validDate(e.acquiredAt) ?? now,
          lastConfirmedAt: validDate(e.lastConfirmedAt) ?? now,
          source: e.source ?? "manual",
          confidence: e.confidence ?? "confirmed",
        })),
      )
      .onConflictDoUpdate({
        target: [schema.pantryItems.userId, schema.pantryItems.canonicalItem],
        set: {
          displayName: sql`excluded.display_name`,
          quantity: sql`excluded.quantity`,
          unit: sql`excluded.unit`,
          acquiredAt: sql`excluded.acquired_at`,
          lastConfirmedAt: sql`excluded.last_confirmed_at`,
          source: sql`excluded.source`,
          confidence: sql`excluded.confidence`,
          updatedAt: new Date(),
        },
      });
  }

  return listPantry(database, userId);
}

/** Change a person's own pantry record without letting a stale client replace the whole row. */
export async function updatePantryItem(
  database: Database,
  userId: string,
  update: PantryEntryUpdate,
): Promise<PantryEntry[]> {
  const set: Partial<typeof schema.pantryItems.$inferInsert> = { updatedAt: new Date() };
  if ("quantity" in update) set.quantity = update.quantity;
  if ("unit" in update) set.unit = update.unit;
  if ("isUsual" in update) set.isUsual = update.isUsual;
  if ("storageLocation" in update) set.storageLocation = update.storageLocation;
  if (update.confirmPresent) {
    set.lastConfirmedAt = new Date();
    set.confidence = "confirmed";
  }

  await database
    .update(schema.pantryItems)
    .set(set)
    .where(and(
      eq(schema.pantryItems.userId, userId),
      eq(schema.pantryItems.canonicalItem, update.canonicalItem),
    ));
  return listPantry(database, userId);
}

export async function removePantryItems(
  database: Database,
  userId: string,
  canonicalItems: string[],
): Promise<PantryEntry[]> {
  if (canonicalItems.length > 0) {
    await database
      .delete(schema.pantryItems)
      .where(
        and(
          eq(schema.pantryItems.userId, userId),
          inArray(schema.pantryItems.canonicalItem, canonicalItems),
        ),
      );
  }
  return listPantry(database, userId);
}

export async function clearPantry(database: Database, userId: string): Promise<void> {
  await database.delete(schema.pantryItems).where(eq(schema.pantryItems.userId, userId));
}

function validDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

// ---------------------------------------------------------------- matching

export interface PantrySearchFilters {
  /** Canonical items on hand. Empty means "use my saved pantry". */
  ingredients?: string[];
  excludeIngredients?: string[];
  /** Recipe must carry at least one of these tags. */
  tags?: string[];
  maxMinutes?: number | null;
  course?: string | null;
  limit?: number;
}

export interface PantrySearchRow extends PantryMatch {
  title: string;
  imageUrl: string | null;
  totalMinutes: number | null;
  tags: string[];
  timesCooked: number;
}

interface RawRow {
  id: string;
  title: string;
  image_url: string | null;
  total_minutes: number | null;
  tags: string[] | null;
  times_cooked: number | null;
  required_count: number | string;
  have_count: number | string;
  missing: string[] | null;
  missing_optional: string[] | null;
  have: string[] | null;
}

/**
 * Rank the user's recipes against a set of ingredients.
 *
 * One query rather than one per recipe: the aggregation happens in Postgres
 * against the flattened `recipe_ingredients` index, so this stays a single
 * round-trip no matter how large the collection gets.
 */
export async function searchByPantry(
  database: Database,
  userId: string,
  filters: PantrySearchFilters = {},
): Promise<PantrySearchRow[]> {
  const {
    ingredients = [],
    excludeIngredients = [],
    tags = [],
    maxMinutes = null,
    course = null,
    limit = 40,
  } = filters;

  const pantry = [...new Set(ingredients)];

  const result = await database.execute(sql`
    with have as (
      select unnest(${sql.param(pantry)}::text[]) as item
    ),
    staple as (
      select unnest(${sql.param(STAPLES)}::text[]) as item
    ),
    needed as (
      select
        ri.recipe_id,
        ri.canonical_item,
        ri.optional
      from ${schema.recipeIngredients} ri
      where not exists (select 1 from staple s where s.item = ri.canonical_item)
    )
    select
      r.id,
      r.title,
      r.image_url,
      r.total_minutes,
      r.tags,
      coalesce(rt.times_cooked, 0) as times_cooked,
      count(n.canonical_item) filter (where not n.optional) as required_count,
      count(n.canonical_item) filter (
        where not n.optional and exists (select 1 from have h where h.item = n.canonical_item)
      ) as have_count,
      coalesce(array_agg(n.canonical_item) filter (
        where not n.optional and exists (select 1 from have h where h.item = n.canonical_item)
      ), '{}') as have,
      coalesce(array_agg(n.canonical_item) filter (
        where not n.optional and not exists (select 1 from have h where h.item = n.canonical_item)
      ), '{}') as missing,
      coalesce(array_agg(n.canonical_item) filter (
        where n.optional and not exists (select 1 from have h where h.item = n.canonical_item)
      ), '{}') as missing_optional
    from ${schema.recipes} r
    left join needed n on n.recipe_id = r.id
    left join ${schema.ratings} rt on rt.recipe_id = r.id and rt.user_id = ${userId}
    where r.owner_id = ${userId}
      ${
        excludeIngredients.length > 0
          ? sql`and not exists (
              select 1 from ${schema.recipeIngredients} x
              where x.recipe_id = r.id
                and x.canonical_item = any(${sql.param(excludeIngredients)}::text[])
            )`
          : sql``
      }
      ${tags.length > 0 ? sql`and r.tags && ${sql.param(tags)}::text[]` : sql``}
      ${
        // A recipe with no recorded time is kept rather than hidden — an unknown
        // duration isn't evidence that it's slow.
        maxMinutes !== null
          ? sql`and (r.total_minutes is null or r.total_minutes <= ${maxMinutes})`
          : sql``
      }
      ${course ? sql`and lower(r.course) = ${course.toLowerCase()}` : sql``}
    group by r.id, rt.times_cooked
    limit ${limit}
  `);

  const rows = (Array.isArray(result) ? result : (result.rows ?? [])) as unknown as RawRow[];

  const matches: PantrySearchRow[] = rows.map((row) => {
    const requiredCount = Number(row.required_count ?? 0);
    const have = row.have ?? [];
    const missing = row.missing ?? [];

    return {
      recipeId: row.id,
      title: row.title,
      imageUrl: row.image_url,
      totalMinutes: row.total_minutes,
      tags: row.tags ?? [],
      timesCooked: Number(row.times_cooked ?? 0),
      have,
      missing,
      missingOptional: row.missing_optional ?? [],
      // Staples are assumed present, so nothing is reported missing here.
      // Tracking which staples a cook is out of is a later slice.
      missingStaples: [],
      coverage: requiredCount === 0 ? 1 : have.length / requiredCount,
      canMakeNow: missing.length === 0,
    };
  });

  const timesCooked = new Map(matches.map((m) => [m.recipeId, m.timesCooked]));
  return rankMatches(matches, timesCooked);
}
