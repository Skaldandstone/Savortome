import { and, count, eq, gt, isNull, like, sql } from "drizzle-orm";
import { MAX_RECIPE_PHOTOS, isUuid, type RecipePhoto } from "@seconds/core";
import type { Database } from "../client.js";
import * as schema from "../schema.js";

function validKey(ownerId: string, recipeId: string, key: string): boolean {
  if (!isUuid(ownerId) || !isUuid(recipeId)) return false;
  const prefix = `recipes/${ownerId}/${recipeId}/`;
  const suffix = key.slice(prefix.length);
  const match = /^([0-9a-f-]+)\.(jpg|png|webp)$/.exec(suffix);
  return key.startsWith(prefix) && Boolean(match && isUuid(match[1]!));
}

type Refusal = { ok: false; reason: "not_found" | "at_limit" };

/** Must commit before PUT; one-hour eligibility hold, not automatic erasure.
 * Future web integration must bound/abort uploads well inside that hold.
 * No user FK: account deletion cannot discard the pending upload reference.
 */
export async function reserveRecipePhotoUpload(
  database: Database, ownerId: string, recipeId: string, key: string,
): Promise<{ ok: true } | Refusal> {
  if (!validKey(ownerId, recipeId, key)) throw new Error("Invalid photo upload reference.");
  return database.transaction(async tx => {
    const [recipe] = await tx.select({ photos: schema.recipes.photos }).from(schema.recipes)
      .where(and(eq(schema.recipes.id, recipeId), eq(schema.recipes.ownerId, ownerId))).for("update");
    if (!recipe) return { ok: false, reason: "not_found" };
    if (recipe.photos.some(photo => photo.key === key)) throw new Error("Photo upload reference already exists.");
    const [pending] = await tx.select({ n: count() }).from(schema.pendingPhotoDeletions).where(and(
      like(schema.pendingPhotoDeletions.key, `recipes/${ownerId}/${recipeId}/%`),
      eq(schema.pendingPhotoDeletions.attempts, 0),
      isNull(schema.pendingPhotoDeletions.lastAttemptAt),
      gt(schema.pendingPhotoDeletions.retryAfter, sql`statement_timestamp()`),
    ));
    if (recipe.photos.length + (pending?.n ?? 0) >= MAX_RECIPE_PHOTOS) return { ok: false, reason: "at_limit" };
    const [reserved] = await tx.insert(schema.pendingPhotoDeletions).values({
      key, retryAfter: sql`statement_timestamp() + interval '1 hour'`,
    }).onConflictDoNothing().returning({ key: schema.pendingPhotoDeletions.key });
    if (!reserved) throw new Error("Photo upload reference already exists.");
    return { ok: true };
  });
}

/** Photo append and reservation acknowledgement share one transaction.
 * Uncertain commit is not permission to immediately erase: re-read/retry first.
 */
export async function attachReservedRecipePhoto(
  database: Database, ownerId: string, recipeId: string, photo: RecipePhoto,
): Promise<{ ok: true; photos: RecipePhoto[] } | Refusal> {
  if (!validKey(ownerId, recipeId, photo.key)) throw new Error("Invalid photo upload reference.");
  return database.transaction(async tx => {
    const [recipe] = await tx.select({ photos: schema.recipes.photos }).from(schema.recipes)
      .where(and(eq(schema.recipes.id, recipeId), eq(schema.recipes.ownerId, ownerId))).for("update");
    if (!recipe) return { ok: false, reason: "not_found" };
    const existing = recipe.photos.find(p => p.key === photo.key);
    if (existing) {
      if (existing.url !== photo.url || existing.createdAt !== photo.createdAt) throw new Error("Photo upload confirmation changed.");
      return { ok: true, photos: recipe.photos };
    }
    const [reservation] = await tx.select({ key: schema.pendingPhotoDeletions.key }).from(schema.pendingPhotoDeletions)
      .where(and(eq(schema.pendingPhotoDeletions.key, photo.key),
        eq(schema.pendingPhotoDeletions.attempts, 0), isNull(schema.pendingPhotoDeletions.lastAttemptAt),
        gt(schema.pendingPhotoDeletions.retryAfter, sql`statement_timestamp()`))).for("update");
    if (!reservation) throw new Error("Photo upload reservation is unavailable.");
    if (recipe.photos.length >= MAX_RECIPE_PHOTOS) return { ok: false, reason: "at_limit" };
    const [updated] = await tx.update(schema.recipes).set({
      photos: sql`${schema.recipes.photos} || ${JSON.stringify([photo])}::jsonb`,
    }).where(eq(schema.recipes.id, recipeId)).returning({ photos: schema.recipes.photos });
    if (!updated) throw new Error("Photo attachment was not confirmed.");
    await tx.delete(schema.pendingPhotoDeletions).where(eq(schema.pendingPhotoDeletions.key, photo.key));
    return { ok: true, photos: updated.photos };
  });
}
