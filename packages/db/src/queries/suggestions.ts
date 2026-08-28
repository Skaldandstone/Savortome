import { and, desc, eq } from "drizzle-orm";
import { canView, type MealSlot, type PlanSuggestion } from "@seconds/core";
import type { Database } from "../client.js";
import * as schema from "../schema.js";
import { friendIdsOf, saveSharedRecipe } from "./sharing.js";
import { addToPlan } from "./plan.js";

/**
 * A friend proposing a recipe for your calendar — async co-op planning
 * scoped to the one relationship the app already models trust through.
 *
 * Nothing here ever writes to `mealPlanEntries` directly on someone else's
 * behalf: a suggestion is its own row until its owner accepts it, and
 * accepting runs through the same `saveSharedRecipe` + `addToPlan` path a
 * shared recipe already uses, so the same visibility and ownership rules
 * apply without being re-derived here.
 */

export class SuggestionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SuggestionError";
  }
}

/**
 * Propose a recipe for a friend's plan. Requires the two to actually be
 * friends, and the recipe to already be something the friend could see —
 * suggesting is not a way to preview a title through a door that's shut.
 */
export async function suggestForFriend(
  database: Database,
  suggesterId: string,
  ownerId: string,
  recipeId: string,
  date: string,
  slot: MealSlot,
): Promise<void> {
  if (suggesterId === ownerId) {
    throw new SuggestionError("Just add it to your own plan.");
  }

  const suggesterFriends = await friendIdsOf(database, suggesterId);
  if (!suggesterFriends.has(ownerId)) {
    throw new SuggestionError("You can only suggest a meal to a friend.");
  }

  const recipe = await database.query.recipes.findFirst({
    where: eq(schema.recipes.id, recipeId),
    columns: { ownerId: true, visibility: true },
  });
  const ownerFriends = await friendIdsOf(database, ownerId);
  if (!recipe || !canView(recipe, { viewerId: ownerId, friendIds: ownerFriends })) {
    throw new SuggestionError("They wouldn't be able to see that recipe.");
  }

  await database
    .insert(schema.planSuggestions)
    .values({ ownerId, suggestedById: suggesterId, recipeId, date, slot })
    .onConflictDoUpdate({
      target: [
        schema.planSuggestions.ownerId,
        schema.planSuggestions.suggestedById,
        schema.planSuggestions.recipeId,
        schema.planSuggestions.date,
        schema.planSuggestions.slot,
      ],
      // Suggesting the same thing again after a dismiss puts it back in front
      // of them, rather than staying invisible because a row already exists.
      set: { status: "pending" },
    });
}

/** Every pending suggestion sitting on someone's own plan. */
export async function pendingSuggestions(
  database: Database,
  ownerId: string,
): Promise<PlanSuggestion[]> {
  const rows = await database
    .select({
      id: schema.planSuggestions.id,
      date: schema.planSuggestions.date,
      slot: schema.planSuggestions.slot,
      recipeId: schema.recipes.id,
      title: schema.recipes.title,
      imageUrl: schema.recipes.imageUrl,
      status: schema.planSuggestions.status,
      handle: schema.users.handle,
      displayName: schema.users.displayName,
      avatarUrl: schema.users.avatarUrl,
    })
    .from(schema.planSuggestions)
    .innerJoin(schema.recipes, eq(schema.recipes.id, schema.planSuggestions.recipeId))
    .innerJoin(schema.users, eq(schema.users.id, schema.planSuggestions.suggestedById))
    .where(and(eq(schema.planSuggestions.ownerId, ownerId), eq(schema.planSuggestions.status, "pending")))
    .orderBy(desc(schema.planSuggestions.createdAt));

  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    slot: r.slot,
    recipeId: r.recipeId,
    title: r.title,
    imageUrl: r.imageUrl,
    status: r.status,
    suggestedBy: { handle: r.handle, displayName: r.displayName, avatarUrl: r.avatarUrl },
  }));
}

/**
 * Accept a suggestion: copy the recipe into the owner's own library — the
 * same one-copy-per-source rule a saved shared recipe already gets — and put
 * it on their calendar. Returns false for a suggestion that isn't yours,
 * isn't pending any more, or whose recipe has gone private since it was
 * proposed (rather than throwing — the friend's page just stops offering it).
 */
export async function acceptSuggestion(
  database: Database,
  ownerId: string,
  suggestionId: string,
): Promise<boolean> {
  const suggestion = await database.query.planSuggestions.findFirst({
    where: and(
      eq(schema.planSuggestions.id, suggestionId),
      eq(schema.planSuggestions.ownerId, ownerId),
      eq(schema.planSuggestions.status, "pending"),
    ),
  });
  if (!suggestion) return false;

  let recipeId: string;
  try {
    recipeId = await saveSharedRecipe(database, ownerId, suggestion.recipeId);
  } catch {
    // The suggester's recipe went private, or was deleted, after they
    // suggested it. Leaving the row pending would just offer it again.
    await database
      .update(schema.planSuggestions)
      .set({ status: "dismissed" })
      .where(eq(schema.planSuggestions.id, suggestionId));
    return false;
  }

  await addToPlan(database, ownerId, recipeId, suggestion.date, suggestion.slot);
  await database
    .update(schema.planSuggestions)
    .set({ status: "accepted" })
    .where(eq(schema.planSuggestions.id, suggestionId));
  return true;
}

/** Turn down a suggestion without adding it to the plan. */
export async function dismissSuggestion(
  database: Database,
  ownerId: string,
  suggestionId: string,
): Promise<boolean> {
  const [updated] = await database
    .update(schema.planSuggestions)
    .set({ status: "dismissed" })
    .where(
      and(
        eq(schema.planSuggestions.id, suggestionId),
        eq(schema.planSuggestions.ownerId, ownerId),
        eq(schema.planSuggestions.status, "pending"),
      ),
    )
    .returning({ id: schema.planSuggestions.id });
  return Boolean(updated);
}
