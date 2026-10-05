// Actual deletion queries + exact 0023 migration, disposable partial PGlite only.
// No storage client, DATABASE_URL, hosted data or multi-connection proof.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {deleteRecipe,removeRecipePhoto} from '../packages/db/src/queries/recipes.ts';
import {deleteUserById} from '../packages/db/src/queries/users.ts';
import * as schema from '../packages/db/src/schema.ts';
const require=createRequire(new URL('../packages/db/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');
const {drizzle}=require('drizzle-orm/pglite');
const {readMigrationFiles}=require('drizzle-orm/migrator');
const journal=JSON.parse(readFileSync('packages/db/migrations/meta/_journal.json','utf8'));
const migrations=readMigrationFiles({migrationsFolder:'packages/db/migrations'});
const migrationIndex=journal.entries.findIndex(entry=>entry.tag==='0023_pending-photo-deletions');
assert.ok(migrationIndex>0);
const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const recipe='00000000-0000-4000-8000-000000000003',foreign='00000000-0000-4000-8000-000000000004';
const key=(user,id,n)=>`recipes/${user}/${id}/00000000-0000-4000-8000-${String(n).padStart(12,'0')}.jpg`;
const first=key(owner,recipe,5),second=key(owner,recipe,6),foreignKey=key(other,foreign,7);
const photo=key=>({key,url:'https://fixture.invalid/photo',createdAt:'2026-10-04T00:00:00Z'});
const rows=async(pg,sql)=>(await pg.query(sql)).rows;
async function fixture(run,{migrate=true,photos=true}={}){
 const pg=new PGlite();
 try{
  const initial=readFileSync('packages/db/migrations/0000_initial_schema.sql','utf8');
  await pg.exec(initial.split('--> statement-breakpoint').find(sql=>sql.includes('CREATE TABLE "users"')));
  await pg.exec(`CREATE TABLE recipes(id uuid PRIMARY KEY,owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE${photos?",photos jsonb NOT NULL DEFAULT '[]'::jsonb":''});`);
  const db=drizzle(pg,{schema});
  await pg.exec(`CREATE SCHEMA drizzle; CREATE TABLE drizzle.__drizzle_migrations(id serial PRIMARY KEY,hash text NOT NULL,created_at bigint);`);
  await pg.query(`INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES ('synthetic-prior',$1)`,[migrations[migrationIndex-1].folderMillis]);
  const migrateExact=()=>db.dialect.migrate(migrations,db.session,{migrationsSchema:'drizzle',migrationsTable:'__drizzle_migrations'});
  if(migrate)await migrateExact();
  await pg.query(`INSERT INTO users(id,email,handle,display_name) VALUES ($1,'owner@example.test','fixture-owner','Owner'),($2,'other@example.test','fixture-other','Other')`,[owner,other]);
  if(photos)await pg.query(`INSERT INTO recipes(id,owner_id,photos) VALUES ($1,$2,$3),($4,$5,$6)`,[recipe,owner,JSON.stringify([photo(first),photo(second)]),foreign,other,JSON.stringify([photo(foreignKey)])]);
  await run({pg,db,migrateExact});
 }finally{await pg.close();}
}
test('photo ledger: actual single removal records only removed key; unchanged update does not duplicate',async()=>fixture(async({pg,db})=>{
 const result=await removeRecipePhoto(db,owner,recipe,first);assert.equal(result.removed,true);assert.deepEqual(result.photos.map(p=>p.key),[second]);
 assert.deepEqual(await rows(pg,'SELECT key FROM pending_photo_deletions'),[{key:first}]);
 await pg.query('UPDATE recipes SET photos=photos WHERE id=$1',[recipe]);
 assert.equal((await rows(pg,'SELECT * FROM pending_photo_deletions')).length,1);
}));
test('photo ledger: actual recipe deletion refuses foreign owner; own deletion retains both keys',async()=>fixture(async({pg,db})=>{
 assert.equal(await deleteRecipe(db,other,recipe),undefined);assert.deepEqual(await rows(pg,'SELECT * FROM pending_photo_deletions'),[]);
 assert.equal((await deleteRecipe(db,owner,recipe)).photos.length,2);
 assert.deepEqual((await rows(pg,'SELECT key FROM pending_photo_deletions ORDER BY key')).map(p=>p.key),[first,second]);
 assert.equal((await rows(pg,'SELECT * FROM recipes')).length,1);
}));
test('photo ledger: actual account cascade preserves cleanup references and other tenant',async()=>fixture(async({pg,db})=>{
 assert.equal((await deleteUserById(db,owner)).photos.length,2);
 assert.deepEqual((await rows(pg,'SELECT key FROM pending_photo_deletions ORDER BY key')).map(p=>p.key),[first,second]);
 assert.deepEqual((await rows(pg,'SELECT id FROM users')).map(p=>p.id),[other]);
 assert.deepEqual((await rows(pg,'SELECT photos FROM recipes'))[0].photos,[photo(foreignKey)]);
 assert.deepEqual((await deleteUserById(db,owner)).photos,[]);
 assert.equal((await rows(pg,'SELECT * FROM pending_photo_deletions')).length,2);
}));
test('photo ledger: insert fault rolls account cascade and ledger back, deliberate retry succeeds',async()=>fixture(async({pg,db})=>{
 await pg.exec(`CREATE FUNCTION reject_cleanup() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture cleanup insert failure'; END $$; CREATE TRIGGER reject_cleanup BEFORE INSERT ON pending_photo_deletions FOR EACH ROW EXECUTE FUNCTION reject_cleanup();`);
 await assert.rejects(deleteUserById(db,owner));
 assert.equal((await rows(pg,'SELECT * FROM users')).length,2);assert.equal((await rows(pg,'SELECT * FROM recipes')).length,2);assert.deepEqual(await rows(pg,'SELECT * FROM pending_photo_deletions'),[]);
 await pg.exec('DROP TRIGGER reject_cleanup ON pending_photo_deletions');await deleteUserById(db,owner);
 assert.equal((await rows(pg,'SELECT * FROM pending_photo_deletions')).length,2);
}));
test('photo ledger: caller rollback restores recipe and removes pending entries',async()=>fixture(async({pg,db})=>{
 await assert.rejects(db.transaction(async tx=>{await deleteRecipe(tx,owner,recipe);throw new Error('synthetic caller rollback');}));
 assert.equal((await rows(pg,'SELECT * FROM recipes')).length,2);assert.deepEqual(await rows(pg,'SELECT * FROM pending_photo_deletions'),[]);
}));
test('photo ledger: foreign-key descriptor cannot become eligible for cleanup',async()=>fixture(async({pg,db})=>{
 await pg.query('UPDATE recipes SET photos=$1 WHERE id=$2',[JSON.stringify([photo(first),photo(second),photo(foreignKey)]),recipe]);
 await assert.rejects(deleteUserById(db,owner));
 assert.equal((await rows(pg,'SELECT * FROM users')).length,2);assert.equal((await rows(pg,'SELECT * FROM recipes')).length,2);assert.deepEqual(await rows(pg,'SELECT * FROM pending_photo_deletions'),[]);
}));
test('photo migration: missing source column rolls DDL/journal back and explicit repair permits retry',async()=>fixture(async({pg,migrateExact})=>{
 await assert.rejects(migrateExact());
 assert.equal((await rows(pg,"SELECT to_regclass('public.pending_photo_deletions') AS table"))[0].table,null);
 assert.equal((await rows(pg,'SELECT * FROM drizzle.__drizzle_migrations')).length,1);
 await pg.exec("ALTER TABLE recipes ADD COLUMN photos jsonb NOT NULL DEFAULT '[]'::jsonb");await migrateExact();await migrateExact();
 assert.equal((await rows(pg,'SELECT * FROM drizzle.__drizzle_migrations')).length,2);
 assert.deepEqual(await rows(pg,'SELECT * FROM pending_photo_deletions'),[]);
},{migrate:false,photos:false}));
test('photo migration: snapshot adds only independent key/time ledger',()=>{
 const prior=JSON.parse(readFileSync('packages/db/migrations/meta/0022_snapshot.json','utf8'));
 const next=JSON.parse(readFileSync('packages/db/migrations/meta/0023_snapshot.json','utf8'));
 const table=next.tables['public.pending_photo_deletions'];assert.deepEqual(Object.keys(table.columns),['key','created_at']);assert.deepEqual(table.foreignKeys,{});
 delete next.tables['public.pending_photo_deletions'];next.id=prior.id;next.prevId=prior.prevId;assert.deepEqual(next,prior);
});
