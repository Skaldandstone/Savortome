// Actual query functions against disposable PostgreSQL; no live DB or provider.
// node --import ./packages/db/node_modules/tsx/dist/loader.mjs scripts/check-food-note-recovery.mjs
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { saveFoodNote, deleteFoodNote, listFoodNotes } from '../packages/db/src/queries/food-log.ts';
import { foodLogReceiptMatches, parseFoodLogInput } from '../packages/core/src/food-log.ts';
import * as schema from '../packages/db/src/schema.ts';
const require = createRequire(new URL('../packages/db/package.json', import.meta.url));
const { PGlite } = require('@electric-sql/pglite');
const { drizzle } = require('drizzle-orm/pglite');
const owner = '00000000-0000-4000-8000-000000000001';
const other = '00000000-0000-4000-8000-000000000002';
const id = '00000000-0000-4000-8000-000000000003';
const input = { id, date: '2026-10-04', title: 'Soup', portion: null, source: 'text' };

test('food-note real-query recovery and tenant boundaries', async t => {
  const pg = new PGlite();
  try {
    await pg.exec(`CREATE TABLE users(id uuid PRIMARY KEY);
      INSERT INTO users VALUES ('${owner}'),('${other}');
      CREATE TABLE food_log_entries(user_id uuid REFERENCES users(id), id uuid, date date NOT NULL,
        title text NOT NULL, portion text, source text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY(user_id,id));`);
    await pg.exec(readFileSync(new URL('../packages/db/migrations/0021_food-note-identities.sql',import.meta.url),'utf8'));
    const db = drizzle(pg, { schema });
    let first, edited;
    await t.test('new save has exact receipt and identical retry leaves revision unchanged', async () => {
      first = await saveFoodNote(db, owner, input);
      assert.equal(foodLogReceiptMatches(input, first), true);
      assert.deepEqual(await saveFoodNote(db, owner, input), first);
    });
    await t.test('different stable-ID retry without revision cannot overwrite', async () => {
      await assert.rejects(saveFoodNote(db, owner, { ...input, title: 'Rice' }), /changed since review/);
      assert.deepEqual((await listFoodNotes(db, owner))[0], first);
    });
    await t.test('reviewed edit advances revision; same edit retry confirms without rewriting', async () => {
      const edit = { ...input, title: 'Rice', expectedUpdatedAt: first.updatedAt };
      edited = await saveFoodNote(db, owner, edit);
      assert.equal(foodLogReceiptMatches(edit, edited), true);
      assert.ok(edited.updatedAt > first.updatedAt);
      assert.deepEqual(await saveFoodNote(db, owner, edit), edited);
    });
    await t.test('old create and old edit cannot revert a newer different edit', async () => {
      await assert.rejects(saveFoodNote(db, owner, input), /changed since review/);
      await assert.rejects(saveFoodNote(db, owner, { ...input, title: 'Toast', expectedUpdatedAt: first.updatedAt }), /changed since review/);
      assert.deepEqual((await listFoodNotes(db, owner))[0], edited);
    });
    await t.test('same ID in another tenant is separate and cross-tenant delete is isolated', async () => {
      assert.deepEqual(await listFoodNotes(db, other), []);
      const own = await saveFoodNote(db, other, { ...input, title: 'Other account' });
      assert.equal(own.title, 'Other account');
      await deleteFoodNote(db, other, id);
      assert.deepEqual((await listFoodNotes(db, owner))[0], edited);
    });
    await t.test('outer rollback undoes nested edit and deletion', async () => {
      await assert.rejects(db.transaction(async tx => {
        await saveFoodNote(tx, owner, { ...input, title: 'Rollback', expectedUpdatedAt: edited.updatedAt });
        await deleteFoodNote(tx, owner, id);
        throw Error('fault after mutation');
      }), /fault after mutation/);
      assert.deepEqual((await listFoodNotes(db, owner))[0], edited);
    });
    await t.test('rapid accepted edits advance exposed millisecond revisions', async () => {
      const next = await saveFoodNote(db, owner, { ...input, title: 'Next', expectedUpdatedAt: edited.updatedAt });
      const later = await saveFoodNote(db, owner, { ...input, title: 'Later', expectedUpdatedAt: next.updatedAt });
      assert.ok(later.updatedAt > next.updatedAt);
      edited = later;
    });
    await t.test('delete is idempotent and stale edit cannot resurrect a deleted row', async () => {
      await deleteFoodNote(db, owner, id); await deleteFoodNote(db, owner, id);
      await assert.rejects(saveFoodNote(db, owner, { ...input, expectedUpdatedAt: edited.updatedAt }), /unavailable/);
      assert.deepEqual(await listFoodNotes(db, owner), []);
    });
    await t.test('new-note retry after deletion cannot resurrect its old identity', async () => {
      await assert.rejects(saveFoodNote(db, owner, input), /removed or is unavailable/);
      assert.deepEqual(await listFoodNotes(db, owner), []);
    });
    await t.test('removal arriving before a delayed new create closes that owner ID', async () => {
      const delayed={...input,id:'00000000-0000-4000-8000-000000000004'};
      await deleteFoodNote(db,owner,delayed.id);
      await assert.rejects(saveFoodNote(db,owner,delayed), /removed or is unavailable/);
      assert.deepEqual(await listFoodNotes(db,owner),[]);
      assert.equal((await saveFoodNote(db,other,delayed)).title,'Soup');
    });
    await t.test('a deliberate new note uses a fresh identity without reopening deleted IDs', async () => {
      const next=await saveFoodNote(db,owner,{...input,id:'00000000-0000-4000-8000-000000000005'});
      assert.equal(next.title,'Soup');
      await assert.rejects(saveFoodNote(db,owner,input), /removed or is unavailable/);
    });
    await t.test('failed food insert rolls back its newly reserved retry identity', async () => {
      const failing={...input,id:'00000000-0000-4000-8000-000000000006'};
      await pg.exec(`CREATE FUNCTION fail_note_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic insert fault'; END $$;
        CREATE TRIGGER fail_note_insert BEFORE INSERT ON food_log_entries FOR EACH ROW EXECUTE FUNCTION fail_note_insert();`);
      await assert.rejects(saveFoodNote(db,owner,failing), error=>error.cause?.message.includes('synthetic insert fault'));
      assert.equal((await pg.query('SELECT count(*) AS count FROM food_note_references WHERE user_id=$1 AND id=$2',[owner,failing.id])).rows[0].count,0);
      await pg.exec('DROP TRIGGER fail_note_insert ON food_log_entries; DROP FUNCTION fail_note_insert();');
      assert.equal((await saveFoodNote(db,owner,failing)).id,failing.id);
    });
    await t.test('failed food delete rolls back its deletion marker and permits exact retry', async () => {
      const kept={...input,id:'00000000-0000-4000-8000-000000000007'};
      const saved=await saveFoodNote(db,owner,kept);
      await pg.exec(`CREATE FUNCTION fail_note_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic delete fault'; END $$;
        CREATE TRIGGER fail_note_delete BEFORE DELETE ON food_log_entries FOR EACH ROW EXECUTE FUNCTION fail_note_delete();`);
      await assert.rejects(deleteFoodNote(db,owner,kept.id), error=>error.cause?.message.includes('synthetic delete fault'));
      assert.equal((await pg.query('SELECT deleted FROM food_note_references WHERE user_id=$1 AND id=$2',[owner,kept.id])).rows[0].deleted,false);
      assert.deepEqual(await saveFoodNote(db,owner,kept),saved);
      await pg.exec('DROP TRIGGER fail_note_delete ON food_log_entries; DROP FUNCTION fail_note_delete();');
      await deleteFoodNote(db,owner,kept.id);
      await assert.rejects(saveFoodNote(db,owner,kept), /removed or is unavailable/);
    });
  } finally { await pg.close(); }
});

test('malformed and mismatched receipts never confirm a reviewed note', () => {
  const receipt = { ...input, createdAt: '2026-10-04T12:00:00.000Z', updatedAt: '2026-10-04T12:00:00.000Z' };
  for (const patch of [{ id: other }, { date: '2026-10-03' }, { title: 'Soup ' }, { portion: undefined }, { source: 'photo' }, { createdAt: '2026-02-30T12:00:00.000Z' }, { updatedAt: undefined }]) {
    assert.equal(foodLogReceiptMatches(input, { ...receipt, ...patch }), false);
  }
  for (const value of [null, [], {}, true]) assert.equal(foodLogReceiptMatches(input, value), false);
  assert.throws(() => parseFoodLogInput({ ...input, expectedUpdatedAt: 'yesterday' }), /Reload/);
});
