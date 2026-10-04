import { and, desc, eq } from "drizzle-orm";
import { foodLogDate, foodLogId, parseFoodLogInput, type FoodLogEntry } from "@seconds/core";
import type { Database } from "../client.js";
import { foodLogEntries } from "../schema.js";

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
/** Stable client IDs make an identical retry safe; ownership is in the conflict key. */
export async function saveFoodNote(database: Database, userId: string, value: unknown): Promise<FoodLogEntry> {
  const input = parseFoodLogInput(value);
  const [row] = await database.insert(foodLogEntries).values({ userId, ...input })
    .onConflictDoUpdate({ target: [foodLogEntries.userId, foodLogEntries.id], set: { date: input.date, title: input.title, portion: input.portion, source: input.source, updatedAt: new Date() } }).returning();
  return view(row!);
}
export async function deleteFoodNote(database: Database, userId: string, id: unknown): Promise<void> {
  await database.delete(foodLogEntries).where(and(eq(foodLogEntries.userId, userId), eq(foodLogEntries.id, foodLogId(id))));
}
