import { and, desc, eq, inArray } from "drizzle-orm";
import type {
  NormalizedPantryIntake,
  PantryEntry,
  PantryIntakeResolution,
  PantryIntakeSource,
  PantryIntakeStatus,
  PantryIntakeView,
} from "@seconds/core";
import type { Database } from "../client.js";
import * as schema from "../schema.js";
import { addPantryItems } from "./pantry.js";

export class PantryIntakeNotFoundError extends Error {
  constructor() {
    super("That pantry review is no longer available.");
    this.name = "PantryIntakeNotFoundError";
  }
}

export async function listPendingPantryIntakes(database: Database, userId: string): Promise<PantryIntakeView[]> {
  const rows = await database
    .select()
    .from(schema.pantryIntakes)
    .where(and(eq(schema.pantryIntakes.userId, userId), eq(schema.pantryIntakes.status, "pending")))
    .orderBy(desc(schema.pantryIntakes.createdAt));
  if (rows.length === 0) return [];
  const items = await database
    .select()
    .from(schema.pantryIntakeItems)
    .where(inArray(schema.pantryIntakeItems.intakeId, rows.map(row => row.id)));
  return rows.map(row => toView(row, items.filter(item => item.intakeId === row.id)));
}

/** Create an idempotent review. Nothing reaches the pantry in this transaction. */
export async function createPantryIntake(
  database: Database,
  userId: string,
  input: NormalizedPantryIntake,
): Promise<PantryIntakeView> {
  return database.transaction(async tx => {
    if (input.externalReference) {
      const [existing] = await tx
        .select()
        .from(schema.pantryIntakes)
        .where(and(
          eq(schema.pantryIntakes.userId, userId),
          eq(schema.pantryIntakes.source, input.source),
          eq(schema.pantryIntakes.externalReference, input.externalReference),
        ))
        .limit(1);
      if (existing) {
        const items = await tx.select().from(schema.pantryIntakeItems).where(eq(schema.pantryIntakeItems.intakeId, existing.id));
        return toView(existing, items);
      }
    }

    const [inserted] = await tx.insert(schema.pantryIntakes).values({
      userId,
      source: input.source,
      externalReference: input.externalReference,
      sourceLabel: input.sourceLabel,
      acquiredAt: input.acquiredAt ? new Date(input.acquiredAt) : null,
    }).onConflictDoNothing({
      target: [schema.pantryIntakes.userId, schema.pantryIntakes.source, schema.pantryIntakes.externalReference],
    }).returning();
    const intake = inserted ?? (input.externalReference ? (await tx
      .select()
      .from(schema.pantryIntakes)
      .where(and(
        eq(schema.pantryIntakes.userId, userId),
        eq(schema.pantryIntakes.source, input.source),
        eq(schema.pantryIntakes.externalReference, input.externalReference),
      ))
      .limit(1))[0] : undefined);
    if (!intake) throw new Error("Pantry intake insert returned no row.");
    if (!inserted) {
      const items = await tx.select().from(schema.pantryIntakeItems).where(eq(schema.pantryIntakeItems.intakeId, intake.id));
      return toView(intake, items);
    }
    const items = await tx.insert(schema.pantryIntakeItems).values(input.items.map(item => ({
      intakeId: intake.id,
      ...item,
    }))).returning();
    return toView(intake, items);
  });
}

/** Apply only explicitly selected rows, within the signed-in owner's locked review. */
export async function resolvePantryIntake(
  database: Database,
  userId: string,
  resolution: PantryIntakeResolution,
): Promise<void> {
  await database.transaction(async tx => {
    const [intake] = await tx
      .select()
      .from(schema.pantryIntakes)
      .where(and(
        eq(schema.pantryIntakes.id, resolution.intakeId),
        eq(schema.pantryIntakes.userId, userId),
        eq(schema.pantryIntakes.status, "pending"),
      ))
      .for("update")
      .limit(1);
    if (!intake) throw new PantryIntakeNotFoundError();

    if (resolution.action === "accept") {
      const selected = await tx
        .select()
        .from(schema.pantryIntakeItems)
        .where(and(
          eq(schema.pantryIntakeItems.intakeId, intake.id),
          inArray(schema.pantryIntakeItems.id, resolution.acceptedItemIds),
        ));
      if (selected.length !== resolution.acceptedItemIds.length) throw new PantryIntakeNotFoundError();
      await addPantryItems(tx as unknown as Database, userId, selected.map((item): PantryEntry => ({
        canonicalItem: item.canonicalItem,
        displayName: item.displayName,
        quantity: item.quantity,
        unit: item.unit,
        isStaple: false,
        acquiredAt: intake.acquiredAt?.toISOString() ?? intake.createdAt.toISOString(),
        lastConfirmedAt: new Date().toISOString(),
        source: intake.source as PantryEntry["source"],
        confidence: "confirmed",
      })));
    }

    await tx.update(schema.pantryIntakes).set({
      status: resolution.action === "accept" ? "accepted" : "dismissed",
      resolvedAt: new Date(),
    }).where(eq(schema.pantryIntakes.id, intake.id));
  });
}

function toView(
  row: typeof schema.pantryIntakes.$inferSelect,
  items: Array<typeof schema.pantryIntakeItems.$inferSelect>,
): PantryIntakeView {
  return {
    id: row.id,
    source: row.source as PantryIntakeSource,
    sourceLabel: row.sourceLabel,
    acquiredAt: row.acquiredAt?.toISOString() ?? null,
    status: row.status as PantryIntakeStatus,
    createdAt: row.createdAt.toISOString(),
    items: items.map(item => ({
      id: item.id,
      canonicalItem: item.canonicalItem,
      displayName: item.displayName,
      quantity: item.quantity,
      unit: item.unit,
    })),
  };
}
