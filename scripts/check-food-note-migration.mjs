// Exact migration 0020 + installed Drizzle dialect on disposable PGlite.
// PARTIAL baseline: real users/pantry table DDL and migrations 0018/0019 only.
// This does not establish a full pgvector bootstrap or hosted/multi-client proof.
// node --import ./packages/db/node_modules/tsx/dist/loader.mjs scripts/check-food-note-migration.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {saveFoodNote,deleteFoodNote,listFoodNotes} from '../packages/db/src/queries/food-log.ts';
import * as schema from '../packages/db/src/schema.ts';
const require=createRequire(new URL('../packages/db/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');
const {drizzle}=require('drizzle-orm/pglite');
const {readMigrationFiles}=require('drizzle-orm/migrator');
const folder=resolve('packages/db/migrations');
const journal=JSON.parse(readFileSync(resolve(folder,'meta/_journal.json'),'utf8'));
const migrations=readMigrationFiles({migrationsFolder:folder});
const targetIndex=journal.entries.findIndex(e=>e.tag==='0020_food-notes');
assert.ok(targetIndex>0,'Food-note migration must have a reviewed predecessor');
const target=migrations[targetIndex];
const prior=migrations[targetIndex-1];
const owner='00000000-0000-4000-8000-000000000001';
const other='00000000-0000-4000-8000-000000000002';
const noteId='00000000-0000-4000-8000-000000000003';
const initial=readFileSync(resolve(folder,'0000_initial_schema.sql'),'utf8');
function tableDDL(name){const ddl=initial.split('--> statement-breakpoint').find(sql=>sql.includes(`CREATE TABLE "${name}"`));assert.ok(ddl,`Missing reviewed ${name} DDL`);return ddl;}
async function baseline(){
 const pg=new PGlite();
 try {
  await pg.exec(tableDDL('users')+tableDDL('pantry_items'));
  await pg.exec(readFileSync(resolve(folder,'0018_loose_switch.sql'),'utf8'));
  await pg.exec(readFileSync(resolve(folder,'0019_nosy_warstar.sql'),'utf8'));
  await pg.query(`INSERT INTO users(id,email,handle,display_name) VALUES ($1,'owner@example.test','fixture-owner','Fixture owner'),($2,'other@example.test','fixture-other','Fixture other')`,[owner,other]);
  await pg.query(`INSERT INTO pantry_items(user_id,canonical_item,display_name,quantity,unit) VALUES ($1,'banana','Bananas',6,'count')`,[owner]);
  await pg.exec(`CREATE SCHEMA drizzle; CREATE TABLE drizzle.__drizzle_migrations(id serial PRIMARY KEY,hash text NOT NULL,created_at bigint);`);
  await pg.query(`INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES ($1,$2)`,[prior.hash,prior.folderMillis]);
  return {pg,db:drizzle(pg,{schema})};
 } catch(cause){await pg.close();throw cause;}
}
async function apply(db,migration=target){await db.dialect.migrate([migration],db.session,{migrationsSchema:'drizzle'});}
const rows=async(pg,sql,args=[])=> (await pg.query(sql,args)).rows;
test('0020 exact additive migration preserves pantry and prior journal; second run is a no-op',async()=>{
 const {pg,db}=await baseline();try{
  const pantry=await rows(pg,'SELECT * FROM pantry_items');
  await apply(db);assert.deepEqual(await rows(pg,'SELECT * FROM pantry_items'),pantry);
  const history=await rows(pg,'SELECT hash,created_at FROM drizzle.__drizzle_migrations ORDER BY id');
  assert.equal(history.length,2);assert.equal(history[0].hash,prior.hash);assert.equal(history[1].hash,target.hash);assert.equal(Number(history[1].created_at),target.folderMillis);
  await apply(db);assert.deepEqual(await rows(pg,'SELECT hash,created_at FROM drizzle.__drizzle_migrations ORDER BY id'),history);
 }finally{await pg.close();}
});
test('migration fault after table creation rolls back schema and journal, then retries cleanly',async()=>{
 const {pg,db}=await baseline();try{
  const pantry=await rows(pg,'SELECT * FROM pantry_items');
  const fault={...target,sql:[target.sql[0],'SELECT 1 / 0;',...target.sql.slice(1)]};
  await assert.rejects(apply(db,fault),error=>error.cause?.code==='22012');
  assert.equal((await rows(pg,`SELECT to_regclass('public.food_log_entries') AS name`))[0].name,null);
  assert.equal((await rows(pg,'SELECT count(*) AS count FROM drizzle.__drizzle_migrations'))[0].count,1);
  assert.deepEqual(await rows(pg,'SELECT * FROM pantry_items'),pantry);
  await apply(db);assert.equal((await rows(pg,'SELECT count(*) AS count FROM drizzle.__drizzle_migrations'))[0].count,2);
 }finally{await pg.close();}
});
test('exact food-note schema has owner composite identity, cascade FK, date index and no raw media',async()=>{
 const {pg,db}=await baseline();try{
  await apply(db);
  const columns=await rows(pg,`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='food_log_entries' ORDER BY ordinal_position`);
  assert.deepEqual(columns.map(c=>c.column_name),['user_id','id','date','title','portion','source','created_at','updated_at']);
  const constraints=await rows(pg,`SELECT contype,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='food_log_entries'::regclass`);
  assert.ok(constraints.some(c=>c.contype==='p'&&/PRIMARY KEY \(user_id, id\)/.test(c.definition)));
  assert.ok(constraints.some(c=>c.contype==='f'&&/REFERENCES users\(id\) ON DELETE CASCADE/.test(c.definition)));
  assert.ok((await rows(pg,`SELECT indexdef FROM pg_indexes WHERE tablename='food_log_entries' AND indexname='food_log_user_date_idx'`)).some(c=>/\(user_id, date\)/.test(c.indexdef)));
 }finally{await pg.close();}
});
test('0020/0021 migrated real queries preserve tenant identity and cascade only the deleted account',async()=>{
 const {pg,db}=await baseline();try{
  await apply(db);await apply(db,migrations[targetIndex+1]);const input={id:noteId,date:'2026-10-04',title:'Soup',portion:null,source:'text'};
  await saveFoodNote(db,owner,input);await saveFoodNote(db,other,{...input,title:'Other soup'});
  assert.equal((await listFoodNotes(db,owner))[0].title,'Soup');assert.equal((await listFoodNotes(db,other))[0].title,'Other soup');
  await pg.query('DELETE FROM users WHERE id=$1',[owner]);assert.deepEqual(await listFoodNotes(db,owner),[]);assert.equal((await listFoodNotes(db,other))[0].title,'Other soup');
  assert.equal((await rows(pg,'SELECT count(*) AS count FROM food_note_references WHERE user_id=$1',[owner]))[0].count,0);
  await assert.rejects(saveFoodNote(db,owner,{...input,id:'00000000-0000-4000-8000-000000000004'}),error=>error.cause?.code==='23503');
  assert.equal((await listFoodNotes(db,other)).length,1);
 }finally{await pg.close();}
});
test('0021 backfills only present IDs and preserves contents; retained deletion markers contain no food',async()=>{
 const {pg,db}=await baseline();try{
  await apply(db);
  await pg.query(`INSERT INTO food_log_entries(user_id,id,date,title,source) VALUES($1,$2,'2026-10-04','Existing note','text')`,[owner,noteId]);
  const content=await rows(pg,'SELECT * FROM food_log_entries');
  await apply(db,migrations[targetIndex+1]);assert.deepEqual(await rows(pg,'SELECT * FROM food_log_entries'),content);
  assert.deepEqual(await rows(pg,'SELECT * FROM food_note_references'),[{user_id:owner,id:noteId,deleted:false}]);
  const columns=await rows(pg,`SELECT column_name FROM information_schema.columns WHERE table_name='food_note_references' ORDER BY ordinal_position`);
  assert.deepEqual(columns.map(c=>c.column_name),['user_id','id','deleted']);
  await apply(db,migrations[targetIndex+1]);assert.equal((await rows(pg,'SELECT count(*) AS count FROM food_note_references'))[0].count,1);
 }finally{await pg.close();}
});

test('account cascade fault rolls back notes and live/deleted identities; deliberate retry affects only that account',async()=>{
 const {pg,db}=await baseline();try{
  await apply(db);await apply(db,migrations[targetIndex+1]);
  const input={id:noteId,date:'2026-10-04',title:'Owner note',portion:null,source:'text'};
  const removedId='00000000-0000-4000-8000-000000000008';
  await saveFoodNote(db,owner,input);await saveFoodNote(db,other,{...input,title:'Other note'});
  await saveFoodNote(db,owner,{...input,id:removedId});await deleteFoodNote(db,owner,removedId);
  await saveFoodNote(db,other,{...input,id:removedId});await deleteFoodNote(db,other,removedId);
  const notes=await rows(pg,'SELECT * FROM food_log_entries ORDER BY user_id,id');
  const references=await rows(pg,'SELECT * FROM food_note_references ORDER BY user_id,id');
  const pantry=await rows(pg,'SELECT * FROM pantry_items');
  await pg.exec(`CREATE FUNCTION fail_identity_cascade() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic account cascade fault'; END $$;
    CREATE TRIGGER fail_identity_cascade BEFORE DELETE ON food_note_references FOR EACH ROW EXECUTE FUNCTION fail_identity_cascade();`);
  await assert.rejects(pg.query('DELETE FROM users WHERE id=$1',[owner]),/synthetic account cascade fault/);
  assert.equal((await rows(pg,'SELECT count(*) AS count FROM users WHERE id=$1',[owner]))[0].count,1);
  assert.deepEqual(await rows(pg,'SELECT * FROM food_log_entries ORDER BY user_id,id'),notes);
  assert.deepEqual(await rows(pg,'SELECT * FROM food_note_references ORDER BY user_id,id'),references);
  assert.deepEqual(await rows(pg,'SELECT * FROM pantry_items'),pantry);
  await pg.exec('DROP TRIGGER fail_identity_cascade ON food_note_references; DROP FUNCTION fail_identity_cascade();');
  await pg.query('DELETE FROM users WHERE id=$1',[owner]);
  assert.deepEqual(await rows(pg,'SELECT * FROM food_note_references ORDER BY user_id,id'),references.filter(r=>r.user_id===other));
  assert.deepEqual(await listFoodNotes(db,owner),[]);assert.equal((await listFoodNotes(db,other))[0].title,'Other note');
  assert.equal((await rows(pg,'SELECT count(*) AS count FROM users WHERE id=$1',[owner]))[0].count,0);
  await assert.rejects(saveFoodNote(db,owner,input),error=>error.cause?.code==='23503');
  await assert.rejects(saveFoodNote(db,other,{...input,id:removedId}),/removed or is unavailable/);
 }finally{await pg.close();}
});
test('0021 fault after backfill rolls back marker table and journal while keeping existing notes',async()=>{
 const {pg,db}=await baseline();try{
  await apply(db);await pg.query(`INSERT INTO food_log_entries(user_id,id,date,title,source) VALUES($1,$2,'2026-10-04','Existing note','text')`,[owner,noteId]);
  const content=await rows(pg,'SELECT * FROM food_log_entries');const migration=migrations[targetIndex+1];
  await assert.rejects(apply(db,{...migration,sql:[...migration.sql,'SELECT 1/0;']}),error=>error.cause?.code==='22012');
  assert.equal((await rows(pg,`SELECT to_regclass('public.food_note_references') AS name`))[0].name,null);
  assert.equal((await rows(pg,'SELECT count(*) AS count FROM drizzle.__drizzle_migrations'))[0].count,2);
  assert.deepEqual(await rows(pg,'SELECT * FROM food_log_entries'),content);
  await apply(db,migration);assert.equal((await rows(pg,'SELECT count(*) AS count FROM food_note_references'))[0].count,1);
 }finally{await pg.close();}
});
test('0021 generated metadata changes only the reference table and links to the prior snapshot',()=>{
 const previous=JSON.parse(readFileSync(resolve(folder,'meta/0020_snapshot.json'),'utf8'));
 const current=JSON.parse(readFileSync(resolve(folder,'meta/0021_snapshot.json'),'utf8'));
 assert.equal(current.prevId,previous.id);
 assert.equal(journal.entries[targetIndex+1].tag,'0021_food-note-identities');
 assert.equal(journal.entries[targetIndex+1].idx,21);
 for(const [name,table] of Object.entries(previous.tables))assert.deepEqual(current.tables[name],table);
 assert.deepEqual(Object.keys(current.tables).filter(name=>!previous.tables[name]),['public.food_note_references']);
 assert.deepEqual(Object.keys(current.tables['public.food_note_references'].columns),['user_id','id','deleted']);
 for(const key of ['enums','schemas','sequences','roles','policies','views'])assert.deepEqual(current[key],previous[key]);
});
