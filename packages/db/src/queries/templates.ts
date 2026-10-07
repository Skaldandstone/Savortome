import { and, eq, inArray, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import {
  canView,
  isUuid,
  parseMealTemplateCreate,
  parseMealTemplateRename,
  type MealTemplateRenameInput,
  type MealTemplate,
  type SharedTemplateView,
  type TemplateItem,
  type TemplateRole,
  type Visibility,
} from "@seconds/core";
import type { Database } from "../client.js";
import * as schema from "../schema.js";
import { friendIdsOf, saveSharedRecipe } from "./sharing.js";

/**
 * Saving and sharing a named meal — a main plus whichever side, drink, and
 * dessert go with it. The same access-control shape as sharing a single
 * recipe (`sharing.ts`), one level up: a template's own visibility gates
 * whether a stranger can see it at all, and each recipe inside it is still
 * gated by its own visibility on top of that, so a template can never leak a
 * recipe its own owner hasn't chosen to share.
 */

export class SaveTemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SaveTemplateError";
  }
}

/** Creates a template from recipes the owner already has. Rejects anything that isn't theirs. */
export async function createTemplate(
  database: Database,
  ownerId: string,
  name: string,
  items: { role: TemplateRole; recipeId: string }[],
  requestId?: string,
): Promise<string> {
  let input;
  try { input = parseMealTemplateCreate({ id: requestId, name, items }); }
  catch (cause) { throw new SaveTemplateError(cause instanceof Error ? cause.message : "Review the meal before saving."); }
  const recipeIds = [...new Set(input.items.map(i => i.recipeId))];
  const identityId = input.id ?? randomUUID();
  return database.transaction(async tx => {
    // Create/delete lock the same content-free identity before the grouping.
    const [claimed] = await tx.insert(schema.mealTemplateReferences)
      .values({ id: identityId, ownerId }).onConflictDoNothing().returning({ id: schema.mealTemplateReferences.id });
    const [identity] = await tx.select().from(schema.mealTemplateReferences)
      .where(eq(schema.mealTemplateReferences.id, identityId)).for("update");
    if (!identity || identity.ownerId !== ownerId || identity.deleted) {
      throw new SaveTemplateError("That meal request cannot be reused. Check your saved meals before making a new request.");
    }

    // Lock the owned recipe rows through the template/item inserts so deletion
    // or an ownership change cannot race the check. Share locks allow reads.
    const owned = await tx
      .select({ id: schema.recipes.id })
      .from(schema.recipes)
      .where(and(eq(schema.recipes.ownerId, ownerId), inArray(schema.recipes.id, recipeIds)))
      .orderBy(schema.recipes.id)
      .for("share");
    if (owned.length !== recipeIds.length) {
      throw new SaveTemplateError("A template can only be built from your own recipes.");
    }

    const confirmExisting = async () => {
      const existing = await tx.query.mealTemplates.findFirst({ where: and(eq(schema.mealTemplates.id, identityId), eq(schema.mealTemplates.ownerId, ownerId)) });
      const existingItems = existing ? await tx.query.mealTemplateItems.findMany({ where: eq(schema.mealTemplateItems.templateId, identityId) }) : [];
      if (!existing || existing.name !== input.name || existingItems.length !== input.items.length || !input.items.every(item => existingItems.some(saved => saved.role === item.role && saved.recipeId === item.recipeId))) throw new SaveTemplateError("That meal request cannot be reused. Check your saved meals before making a new request.");
      return existing.id;
    };
    // A retained identity without its grouping is not permission to recreate it.
    if (!claimed) return confirmExisting();
    const [created] = await tx.insert(schema.mealTemplates)
      .values({ id: identityId, ownerId, name: input.name })
      .onConflictDoNothing().returning({ id: schema.mealTemplates.id });
    if (!created) return confirmExisting();
    const templateId = created.id;

    await tx
      .insert(schema.mealTemplateItems)
      .values(input.items.map(i => ({ templateId, role: i.role, recipeId: i.recipeId })));

    return templateId;
  });
}

async function itemsFor(database: Database, templateIds: string[]): Promise<Map<string, TemplateItem[]>> {
  if (templateIds.length === 0) return new Map();
  const rows = await database
    .select({
      templateId: schema.mealTemplateItems.templateId,
      role: schema.mealTemplateItems.role,
      recipeId: schema.recipes.id,
      title: schema.recipes.title,
      imageUrl: schema.recipes.imageUrl,
      ownerId: schema.recipes.ownerId,
      visibility: schema.recipes.visibility,
    })
    .from(schema.mealTemplateItems)
    .innerJoin(schema.recipes, eq(schema.recipes.id, schema.mealTemplateItems.recipeId))
    .where(inArray(schema.mealTemplateItems.templateId, templateIds));

  const byTemplate = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byTemplate.get(row.templateId) ?? [];
    list.push(row);
    byTemplate.set(row.templateId, list);
  }
  const out = new Map<string, TemplateItem[]>();
  for (const [id, list] of byTemplate) {
    out.set(
      id,
      list.map((r) => ({ role: r.role, recipeId: r.recipeId, title: r.title, imageUrl: r.imageUrl })),
    );
  }
  return out;
}

/** Every template someone owns, dishes and all. */
export async function listTemplates(database: Database, ownerId: string): Promise<MealTemplate[]> {
  const rows = await database.query.mealTemplates.findMany({
    where: eq(schema.mealTemplates.ownerId, ownerId),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  });
  const items = await itemsFor(database, rows.map((r) => r.id));
  return rows.map((r) => ({ id: r.id, name: r.name, visibility: r.visibility, items: items.get(r.id) ?? [] }));
}

/** Change who can see a template. Only the owner can. */
export async function setTemplateVisibility(
  database: Database,
  ownerId: string,
  templateId: string,
  visibility: Visibility,
): Promise<{ visibility: Visibility } | null> {
  if (!isUuid(templateId)) return null;
  const [updated] = await database
    .update(schema.mealTemplates)
    .set({ visibility })
    .where(and(eq(schema.mealTemplates.id, templateId), eq(schema.mealTemplates.ownerId, ownerId)))
    .returning({ visibility: schema.mealTemplates.visibility });
  return updated ?? null;
}

/** Throw away a template. The recipes inside it are untouched. */
export async function deleteTemplate(
  database: Database,
  ownerId: string,
  templateId: string,
): Promise<boolean> {
  if (!isUuid(templateId)) return false;
  return database.transaction(async tx => {
    // Older writers can create groupings after the migration's backfill. Adopt
    // only an existing owned row, never an arbitrary or another owner's ID.
    // Reserve the identity before deleting, using the same lock order as create.
    await tx.execute(sql`INSERT INTO meal_template_references (id, owner_id)
      SELECT id, owner_id FROM meal_templates
      WHERE id = ${templateId}::uuid AND owner_id = ${ownerId}::uuid
      ON CONFLICT (id) DO NOTHING`);
    const [identity] = await tx.select().from(schema.mealTemplateReferences)
      .where(and(eq(schema.mealTemplateReferences.id, templateId), eq(schema.mealTemplateReferences.ownerId, ownerId))).for("update");
    if (!identity || identity.deleted) return false;
    const [deleted] = await tx.delete(schema.mealTemplates)
      .where(and(eq(schema.mealTemplates.id, templateId), eq(schema.mealTemplates.ownerId, ownerId)))
      .returning({ id: schema.mealTemplates.id });
    if (deleted) await tx.update(schema.mealTemplateReferences).set({ deleted: true })
      .where(and(eq(schema.mealTemplateReferences.id, templateId), eq(schema.mealTemplateReferences.ownerId, ownerId)));
    return Boolean(deleted);
  });
}

/** Rename only an owned meal; lock the row through comparison and update. */
export async function renameTemplate(database: Database, ownerId: string, templateId: string, value: MealTemplateRenameInput): Promise<{ id: string; name: string } | null> {
  if (!isUuid(templateId)) return null;
  const input = parseMealTemplateRename(value);
  return database.transaction(async tx => {
    const [existing] = await tx.select({ id: schema.mealTemplates.id, name: schema.mealTemplates.name })
      .from(schema.mealTemplates)
      .where(and(eq(schema.mealTemplates.id, templateId), eq(schema.mealTemplates.ownerId, ownerId)))
      .for("update");
    // Identical retries can confirm the current name without writing again.
    // Name comparison is not a version history or a guarantee against ABA.
    if (!existing || (existing.name !== input.previousName && existing.name !== input.name)) return null;
    if (existing.name === input.name) return existing;
    const [updated] = await tx.update(schema.mealTemplates).set({ name: input.name })
      .where(and(eq(schema.mealTemplates.id, templateId), eq(schema.mealTemplates.ownerId, ownerId)))
      .returning({ id: schema.mealTemplates.id, name: schema.mealTemplates.name });
    return updated ?? null;
  });
}

/**
 * Fetch a template for a viewer who may be anyone at all.
 *
 * Returns null both for "no such template" and "not allowed to see it," same
 * reasoning as `getSharedRecipe`. Any item whose own recipe isn't viewable to
 * this viewer is left out of the result rather than failing the whole thing —
 * a template's own visibility is not a promise about what's inside it.
 */
export async function getSharedTemplate(
  database: Database,
  templateId: string,
  viewerId: string | null,
): Promise<SharedTemplateView | null> {
  if (!isUuid(templateId)) return null;
  const template = await database.query.mealTemplates.findFirst({
    where: eq(schema.mealTemplates.id, templateId),
  });
  if (!template) return null;

  const friendIds = viewerId ? await friendIdsOf(database, viewerId) : undefined;
  if (!canView({ ownerId: template.ownerId, visibility: template.visibility }, { viewerId, friendIds })) {
    return null;
  }

  const [owner, allItems] = await Promise.all([
    database.query.users.findFirst({
      where: eq(schema.users.id, template.ownerId),
      columns: { handle: true, displayName: true, avatarUrl: true },
    }),
    database
      .select({
        role: schema.mealTemplateItems.role,
        recipeId: schema.recipes.id,
        title: schema.recipes.title,
        imageUrl: schema.recipes.imageUrl,
        ownerId: schema.recipes.ownerId,
        visibility: schema.recipes.visibility,
      })
      .from(schema.mealTemplateItems)
      .innerJoin(schema.recipes, eq(schema.recipes.id, schema.mealTemplateItems.recipeId))
      .where(eq(schema.mealTemplateItems.templateId, templateId)),
  ]);

  const items = allItems
    .filter((r) => canView({ ownerId: r.ownerId, visibility: r.visibility }, { viewerId, friendIds }))
    .map((r) => ({ role: r.role, recipeId: r.recipeId, title: r.title, imageUrl: r.imageUrl }));

  return {
    id: template.id,
    name: template.name,
    items,
    sharedBy: {
      handle: owner?.handle ?? "someone",
      displayName: owner?.displayName ?? "Someone",
      avatarUrl: owner?.avatarUrl ?? null,
    },
    canSave: Boolean(viewerId) && viewerId !== template.ownerId,
  };
}

/**
 * Copy someone else's shared template into your own library — each recipe
 * you don't already own gets its own copy via `saveSharedRecipe`, the same
 * one-copy-per-source rule that applies when saving a single shared recipe.
 */
export async function saveSharedTemplate(
  database: Database,
  viewerId: string,
  templateId: string,
): Promise<string> {
  const shared = await getSharedTemplate(database, templateId, viewerId);
  if (!shared) throw new SaveTemplateError("That meal isn't available.");
  if (!shared.canSave) throw new SaveTemplateError("That one's already yours.");
  if (shared.items.length === 0) throw new SaveTemplateError("There's nothing left to save from that meal.");

  const items: { role: TemplateRole; recipeId: string }[] = [];
  for (const item of shared.items) {
    const source = await database.query.recipes.findFirst({
      where: eq(schema.recipes.id, item.recipeId),
      columns: { ownerId: true },
    });
    const recipeId =
      source?.ownerId === viewerId ? item.recipeId : await saveSharedRecipe(database, viewerId, item.recipeId);
    items.push({ role: item.role, recipeId });
  }

  return createTemplate(database, viewerId, shared.name, items);
}
