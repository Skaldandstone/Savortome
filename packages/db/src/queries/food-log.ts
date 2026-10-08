import { and, desc, eq } from "drizzle-orm";
import { foodLogDate, foodLogId, FoodLogValidationError, parseFoodLogInput, type FoodLogEntry } from "@seconds/core";
import type { Database } from "../client.js";
import { foodLogEntries, foodNoteReferences } from "../schema.js";

function view(row: typeof foodLogEntries.$inferSelect): FoodLogEntry {
  return { id: row.id, date: row.date, title: row.title, portion: row.portion, source: row.source,
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
export async function listFoodNotes(database: Database, userId: string, date?: string): Promise<FoodLogEntry[]> {
  const rows = await database.select().from(foodLogEntries)
    .where(date ? and(eq(foodLogEntries.userId, userId), eq(foodLogEntries.date, foodLogDate(date))) : eq(foodLogEntries.userId, userId))
    .orderBy(desc(foodLogEntries.date), desc(foodLogEntries.createdAt)).limit(30);
  return rows.map(view);
}
/** Exact retries confirm current contents; edits require the last-read revision. */
export async function saveFoodNote(database: Database, userId: string, value: unknown): Promise<FoodLogEntry> {
  const input = parseFoodLogInput(value);
  const { expectedUpdatedAt, ...fields } = input;
  return database.transaction(async tx => {
    // One durable owner/ID row serializes saves and removals even when the
    // food row is absent. It holds no title, date, portion or media.
    await tx.insert(foodNoteReferences).values({ userId, id: input.id }).onConflictDoNothing();
    const [reference] = await tx.select().from(foodNoteReferences)
      .where(and(eq(foodNoteReferences.userId, userId), eq(foodNoteReferences.id, input.id))).for("update");
    if (!reference || reference.deleted) throw new FoodLogValidationError("This note was removed or is unavailable. Discard the old local draft and review a new note before saving.");
    if (!expectedUpdatedAt) {
      const [created] = await tx.insert(foodLogEntries).values({ userId, ...fields }).onConflictDoNothing().returning();
      if (created) return view(created);
    }
    // A conflicting insert waits for its transaction before this owner-scoped
    // lock. An edit to a missing/deleted row never recreates it.
    const [existing] = await tx.select().from(foodLogEntries)
      .where(and(eq(foodLogEntries.userId, userId), eq(foodLogEntries.id, input.id))).for("update");
    if (!existing) throw new FoodLogValidationError("This note is unavailable. Reload before making another change.");
    if (existing.date === input.date && existing.title === input.title && existing.portion === input.portion && existing.source === input.source) return view(existing);
    if (!expectedUpdatedAt || existing.updatedAt.toISOString() !== expectedUpdatedAt) throw new FoodLogValidationError("This note changed since review. Reload and review it before saving a new edit.");
    // Keep the exposed millisecond revision distinct even for rapid edits or
    // a local clock behind the previous writer. This is not a global clock.
    const updatedAt = new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1));
    const [updated] = await tx.update(foodLogEntries).set({ date: input.date, title: input.title, portion: input.portion, source: input.source, updatedAt })
      .where(and(eq(foodLogEntries.userId, userId), eq(foodLogEntries.id, input.id))).returning();
    if (!updated) throw new FoodLogValidationError("The edit could not be confirmed. Reload the note.");
    return view(updated);
  });
}
export async function deleteFoodNote(database: Database, userId: string, id: unknown): Promise<void> {
  const noteId = foodLogId(id);
  await database.transaction(async tx => {
    await tx.insert(foodNoteReferences).values({ userId, id: noteId, deleted: true }).onConflictDoNothing();
    // Match the save lock order. A removal arriving before its delayed create
    // permanently closes that ID; another deliberate note gets a new ID.
    await tx.select().from(foodNoteReferences)
      .where(and(eq(foodNoteReferences.userId, userId), eq(foodNoteReferences.id, noteId))).for("update");
    await tx.update(foodNoteReferences).set({ deleted: true })
      .where(and(eq(foodNoteReferences.userId, userId), eq(foodNoteReferences.id, noteId)));
    await tx.delete(foodLogEntries).where(and(eq(foodLogEntries.userId, userId), eq(foodLogEntries.id, noteId)));
  });
}
