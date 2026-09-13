import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { addPantryItems, listPantry, updatePantryItem } from "../src/queries/pantry.js";
import { createPantryIntake, listPendingPantryIntakes, resolvePantryIntake } from "../src/queries/pantry-intake.js";
import * as schema from "../src/schema.js";

const A = "00000000-0000-0000-0000-000000000001";
const B = "00000000-0000-0000-0000-000000000002";

test("pantry memory migration and writes preserve owner isolation and human choices", async () => {
  const pg = new PGlite();
  try {
    await pg.exec(`
      CREATE TABLE users (id uuid PRIMARY KEY);
      INSERT INTO users(id) VALUES ('${A}'), ('${B}');
      CREATE TABLE pantry_items (
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        canonical_item text NOT NULL,
        display_name text NOT NULL,
        quantity real,
        unit text,
        is_staple boolean NOT NULL DEFAULT false,
        updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY(user_id, canonical_item)
      );
    `);
    const migration = readFileSync(new URL("../migrations/0018_loose_switch.sql", import.meta.url), "utf8")
      .replaceAll("--> statement-breakpoint", "");
    await pg.exec(migration);

    const database = drizzle(pg, { schema }) as unknown as Parameters<typeof addPantryItems>[0];
    await addPantryItems(database, A, [{
      canonicalItem: "banana", displayName: "6 bananas", quantity: 6, unit: null, isStaple: false,
    }]);
    await addPantryItems(database, B, [{
      canonicalItem: "banana", displayName: "2 bananas", quantity: 2, unit: null, isStaple: false,
    }]);

    let mine = await listPantry(database, A);
    assert.equal(mine.length, 1);
    assert.equal(mine[0]?.source, "manual");
    assert.equal(mine[0]?.confidence, "confirmed");
    assert.ok(mine[0]?.acquiredAt);
    assert.ok(mine[0]?.lastConfirmedAt);

    await updatePantryItem(database, A, {
      canonicalItem: "banana", isUsual: true, storageLocation: "countertop",
    });
    // Re-adding updates the observed quantity while preserving explicit household settings.
    await addPantryItems(database, A, [{
      canonicalItem: "banana", displayName: "4 bananas", quantity: 4, unit: null, isStaple: false,
    }]);
    mine = await listPantry(database, A);
    assert.equal(mine[0]?.quantity, 4);
    assert.equal(mine[0]?.isUsual, true);
    assert.equal(mine[0]?.storageLocation, "countertop");

    const theirs = await listPantry(database, B);
    assert.equal(theirs[0]?.quantity, 2);
    assert.equal(theirs[0]?.isUsual, false);
    assert.equal(theirs[0]?.storageLocation, "unknown");

    const receipt = await createPantryIntake(database, A, {
      source: "receipt",
      externalReference: "receipt-1",
      sourceLabel: "Neighborhood market",
      acquiredAt: "2026-09-12T12:00:00.000Z",
      items: [{ canonicalItem: "blueberry", displayName: "blueberries", quantity: 1, unit: "pint" }],
    });
    const duplicate = await createPantryIntake(database, A, {
      source: "receipt",
      externalReference: "receipt-1",
      sourceLabel: "Ignored duplicate",
      acquiredAt: null,
      items: [{ canonicalItem: "milk", displayName: "milk", quantity: 1, unit: null }],
    });
    assert.equal(duplicate.id, receipt.id);
    assert.equal((await listPendingPantryIntakes(database, A)).length, 1);
    assert.equal((await listPendingPantryIntakes(database, B)).length, 0);

    await assert.rejects(resolvePantryIntake(database, B, {
      intakeId: receipt.id, action: "accept", acceptedItemIds: [receipt.items[0]!.id],
    }), /no longer available/);

    await pg.exec(`
      CREATE FUNCTION fail_pantry_memory() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'simulated pantry write failure'; END $$ LANGUAGE plpgsql;
      CREATE TRIGGER fail_pantry_memory BEFORE INSERT ON pantry_items FOR EACH ROW EXECUTE FUNCTION fail_pantry_memory();
    `);
    await assert.rejects(resolvePantryIntake(database, A, {
      intakeId: receipt.id, action: "accept", acceptedItemIds: [receipt.items[0]!.id],
    }), (error: unknown) => error instanceof Error &&
      error.cause instanceof Error && /simulated pantry write failure/.test(error.cause.message));
    assert.equal((await listPendingPantryIntakes(database, A)).length, 1);
    assert.equal((await listPantry(database, A)).some(item => item.canonicalItem === "blueberry"), false);

    await pg.exec("DROP TRIGGER fail_pantry_memory ON pantry_items;");
    await resolvePantryIntake(database, A, {
      intakeId: receipt.id, action: "accept", acceptedItemIds: [receipt.items[0]!.id],
    });
    assert.equal((await listPendingPantryIntakes(database, A)).length, 0);
    const accepted = (await listPantry(database, A)).find(item => item.canonicalItem === "blueberry");
    assert.equal(accepted?.quantity, 1);
    assert.equal(accepted?.source, "receipt");
    assert.equal(accepted?.confidence, "confirmed");
  } finally {
    await pg.close();
  }
});
