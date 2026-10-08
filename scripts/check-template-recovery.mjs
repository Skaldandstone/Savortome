// Real template queries + exact migrations 0010/0022 on disposable, partial PGlite.
// Minimal recipe projection deliberately excludes pgvector/full schema bootstrap.
// No DATABASE_URL, hosted data, provider calls or multi-connection proof.
// node --import ./packages/db/node_modules/tsx/dist/loader.mjs scripts/check-template-recovery.mjs
import {test} from 'node:test';
import {createHash} from 'node:crypto';
import {transformSync} from 'esbuild';
import {runInNewContext} from 'node:vm';

import {isUuid} from '../packages/core/src/ids.ts';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {createTemplate,renameTemplate,deleteTemplate,listTemplates} from '../packages/db/src/queries/templates.ts';
import {deleteUserById,findUserForDeletion} from '../packages/db/src/queries/users.ts';
import {saveFoodNote,deleteFoodNote,listFoodNotes} from '../packages/db/src/queries/food-log.ts';
import * as schema from '../packages/db/src/schema.ts';
const require=createRequire(new URL('../packages/db/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');
const {and,eq}=require('drizzle-orm');
const {drizzle}=require('drizzle-orm/pglite');
const {readMigrationFiles}=require('drizzle-orm/migrator');
const journal=JSON.parse(readFileSync('packages/db/migrations/meta/_journal.json','utf8'));
const migrations=readMigrationFiles({migrationsFolder:'packages/db/migrations'});
const migrationIndex=journal.entries.findIndex(entry=>entry.tag==='0022_meal-template-identities');
assert.ok(migrationIndex>0);
const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const recipe='00000000-0000-4000-8000-000000000003',foreign='00000000-0000-4000-8000-000000000004';
const request='00000000-0000-4000-8000-000000000005';
const initial=readFileSync('packages/db/migrations/0000_initial_schema.sql','utf8');
const tableDDL=name=>{const sql=initial.split('--> statement-breakpoint').find(s=>s.includes(`CREATE TABLE "${name}"`));assert.ok(sql);return sql;};
async function fixture(run){
 const pg=new PGlite();
 try{
  await pg.exec(`CREATE TYPE visibility AS ENUM ('private','friends','public');`+tableDDL('users')+tableDDL('pantry_items'));
  await pg.exec(`CREATE TABLE recipes(id uuid PRIMARY KEY,owner_id uuid NOT NULL,title text NOT NULL,image_url text,visibility visibility NOT NULL DEFAULT 'private');`);
  for(const name of ['pantry_items_user_id_users_id_fk','recipes_owner_id_users_id_fk']){
   const ddl=initial.split('--> statement-breakpoint').find(sql=>sql.includes(`ADD CONSTRAINT "${name}"`));
   assert.ok(ddl,`Missing reviewed ${name}`);await pg.exec(ddl);
  }
  await pg.exec(readFileSync('packages/db/migrations/0010_meal-templates.sql','utf8'));
  await pg.exec(readFileSync('packages/db/migrations/0022_meal-template-identities.sql','utf8'));
  await pg.query(`INSERT INTO users(id,email,handle,display_name) VALUES ($1,'owner@example.test','fixture-owner','Owner'),($2,'other@example.test','fixture-other','Other')`,[owner,other]);
  await pg.query(`INSERT INTO recipes(id,owner_id,title) VALUES ($1,$2,'Fixture soup'),($3,$4,'Other soup')`,[recipe,owner,foreign,other]);
  await pg.query(`INSERT INTO pantry_items(user_id,canonical_item,display_name,quantity,unit) VALUES ($1,'banana','Bananas',6,'count')`,[owner]);
  await run({pg,db:drizzle(pg,{schema})});
 }finally{await pg.close();}
}
const rows=async(pg,sql)=> (await pg.query(sql)).rows;
const items=[{role:'main',recipeId:recipe}];
test('template create: identical owner retry confirms; changed/foreign reuse is refused',async()=>fixture(async({pg,db})=>{
 assert.equal(await createTemplate(db,owner,'Soup',items,request),request);
 assert.equal(await createTemplate(db,owner,'Soup',items,request),request);
 await assert.rejects(createTemplate(db,owner,'Changed',items,request));
 await assert.rejects(createTemplate(db,other,'Soup',[{role:'main',recipeId:foreign}],request));
 assert.equal((await rows(pg,'SELECT * FROM meal_templates')).length,1);
 assert.equal((await rows(pg,'SELECT * FROM meal_template_items')).length,1);
}));
test('template ownership: foreign recipes and foreign rename/delete cannot change owned grouping',async()=>fixture(async({db})=>{
 await assert.rejects(createTemplate(db,owner,'Foreign',[{role:'main',recipeId:foreign}],request));
 await createTemplate(db,owner,'Soup',items,request);
 assert.equal(await renameTemplate(db,other,request,{previousName:'Soup',name:'Other title'}),null);
 assert.equal(await deleteTemplate(db,other,request),false);
 assert.deepEqual(await listTemplates(db,other),[]);
 assert.equal((await listTemplates(db,owner))[0].name,'Soup');
}));
test('template rename: exact retry confirms without second update; stale different edit is refused',async()=>fixture(async({pg,db})=>{
 await createTemplate(db,owner,'Soup',items,request);
 await pg.exec(`CREATE TABLE update_count(n integer); INSERT INTO update_count VALUES (0); CREATE FUNCTION count_rename() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE update_count SET n=n+1; RETURN NEW; END $$; CREATE TRIGGER count_rename AFTER UPDATE ON meal_templates FOR EACH ROW EXECUTE FUNCTION count_rename();`);
 const input={previousName:'Soup',name:'Evening soup'};
 assert.equal((await renameTemplate(db,owner,request,input)).name,'Evening soup');
 assert.equal((await renameTemplate(db,owner,request,input)).name,'Evening soup');
 assert.equal(await renameTemplate(db,owner,request,{previousName:'Soup',name:'Stale change'}),null);
 assert.equal((await rows(pg,'SELECT n FROM update_count'))[0].n,1);
}));
test('template insert: item failure rolls grouping back and permits explicit exact retry',async()=>fixture(async({pg,db})=>{
 await pg.exec(`CREATE FUNCTION reject_item() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture item failure'; END $$; CREATE TRIGGER reject_item BEFORE INSERT ON meal_template_items FOR EACH ROW EXECUTE FUNCTION reject_item();`);
 await assert.rejects(createTemplate(db,owner,'Soup',items,request));
 assert.deepEqual(await rows(pg,'SELECT * FROM meal_templates'),[]);
 assert.deepEqual(await rows(pg,'SELECT * FROM meal_template_items'),[]);
 assert.deepEqual(await rows(pg,'SELECT * FROM meal_template_references'),[]);
 await pg.exec('DROP TRIGGER reject_item ON meal_template_items');
 assert.equal(await createTemplate(db,owner,'Soup',items,request),request);
}));
test('template creation without a client request ID still creates a protected identity',async()=>fixture(async({pg,db})=>{
 const id=await createTemplate(db,owner,'Soup',items);
 assert.match(id,/^[a-f0-9-]{36}$/);
 assert.deepEqual(await rows(pg,'SELECT * FROM meal_template_references'),[{id,owner_id:owner,deleted:false}]);
 assert.equal(await deleteTemplate(db,owner,id),true);
 await assert.rejects(createTemplate(db,owner,'Soup',items,id));
}));
test('template delete: cascade failure rolls back; successful deletion preserves recipes and pantry',async()=>fixture(async({pg,db})=>{
 await createTemplate(db,owner,'Soup',items,request);
 const recipes=await rows(pg,'SELECT * FROM recipes ORDER BY id'),pantry=await rows(pg,'SELECT * FROM pantry_items');
 await pg.exec(`CREATE FUNCTION reject_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture cascade failure'; END $$; CREATE TRIGGER reject_delete BEFORE DELETE ON meal_template_items FOR EACH ROW EXECUTE FUNCTION reject_delete();`);
 await assert.rejects(deleteTemplate(db,owner,request));
 assert.equal((await rows(pg,'SELECT * FROM meal_templates')).length,1);
 assert.equal((await rows(pg,'SELECT * FROM meal_template_items')).length,1);
 await pg.exec('DROP TRIGGER reject_delete ON meal_template_items');
 assert.equal(await deleteTemplate(db,owner,request),true);
 assert.equal(await deleteTemplate(db,owner,request),false);
 assert.deepEqual(await listTemplates(db,owner),[]);
 assert.deepEqual(await rows(pg,'SELECT * FROM meal_template_items'),[]);
 assert.deepEqual(await rows(pg,'SELECT * FROM recipes ORDER BY id'),recipes);
 assert.deepEqual(await rows(pg,'SELECT * FROM pantry_items'),pantry);
}));
test('template deletion: late create retry cannot resurrect the deleted grouping',async()=>fixture(async({pg,db})=>{
 await createTemplate(db,owner,'Soup',items,request);
 assert.equal(await deleteTemplate(db,owner,request),true);
 await assert.rejects(createTemplate(db,owner,'Soup',items,request));
 assert.deepEqual(await listTemplates(db,owner),[]);
 assert.deepEqual(await rows(pg,'SELECT * FROM meal_template_items'),[]);
 await assert.rejects(createTemplate(db,other,'Other soup',[{role:'main',recipeId:foreign}],request));
 assert.deepEqual(await listTemplates(db,other),[]);
 assert.deepEqual(await rows(pg,'SELECT * FROM meal_template_references'),[{id:request,owner_id:owner,deleted:true}]);
}));
test('template deletion: marker-write failure restores grouping, items and live identity',async()=>fixture(async({pg,db})=>{
 await createTemplate(db,owner,'Soup',items,request);
 await pg.exec(`CREATE FUNCTION reject_marker() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture marker failure'; END $$; CREATE TRIGGER reject_marker BEFORE UPDATE ON meal_template_references FOR EACH ROW EXECUTE FUNCTION reject_marker();`);
 await assert.rejects(deleteTemplate(db,owner,request));
 assert.equal((await listTemplates(db,owner))[0].items.length,1);
 assert.equal((await rows(pg,'SELECT * FROM meal_template_references'))[0].deleted,false);
 await pg.exec('DROP TRIGGER reject_marker ON meal_template_references');
 assert.equal(await createTemplate(db,owner,'Soup',items,request),request);
 assert.equal(await deleteTemplate(db,owner,request),true);
}));
test('0022 exact partial migration backfills live grouping and second dialect run is a no-op',async()=>fixture(async({pg,db})=>{
 await pg.exec('DROP TABLE meal_template_references');
 await pg.query(`INSERT INTO meal_templates(id,owner_id,name) VALUES ($1,$2,'Legacy soup')`,[request,owner]);
 await pg.query(`INSERT INTO meal_template_items(template_id,role,recipe_id) VALUES ($1,'main',$2)`,[request,recipe]);
 const before=await rows(pg,'SELECT * FROM meal_templates');
 await pg.exec('CREATE SCHEMA drizzle; CREATE TABLE drizzle.__drizzle_migrations(id serial PRIMARY KEY,hash text NOT NULL,created_at bigint)');
 const apply=()=>db.dialect.migrate([migrations[migrationIndex]],db.session,{migrationsSchema:'drizzle'});
 await apply();
 assert.deepEqual(await rows(pg,'SELECT * FROM meal_templates'),before);
 assert.deepEqual(await rows(pg,'SELECT * FROM meal_template_references'),[{id:request,owner_id:owner,deleted:false}]);
 assert.equal(await createTemplate(db,owner,'Legacy soup',items,request),request);
 await apply();
 assert.equal((await rows(pg,'SELECT * FROM drizzle.__drizzle_migrations')).length,1);
 assert.equal(await deleteTemplate(db,owner,request),true);
 await assert.rejects(createTemplate(db,owner,'Legacy soup',items,request));
}));
test('0022 failed backfill rolls DDL and migration journal back, then explicit repaired retry succeeds',async()=>fixture(async({pg,db})=>{
 await pg.exec('DROP TABLE meal_template_references; ALTER TABLE meal_templates DROP CONSTRAINT meal_templates_owner_id_users_id_fk');
 const absentOwner='00000000-0000-4000-8000-000000000099';
 await pg.query(`INSERT INTO meal_templates(id,owner_id,name) VALUES ($1,$2,'Orphan fixture')`,[request,absentOwner]);
 const before=await rows(pg,'SELECT * FROM meal_templates');
 await pg.exec('CREATE SCHEMA drizzle; CREATE TABLE drizzle.__drizzle_migrations(id serial PRIMARY KEY,hash text NOT NULL,created_at bigint)');
 const prior=migrations[migrationIndex-1];
 await pg.query('INSERT INTO drizzle.__drizzle_migrations(hash,created_at) VALUES ($1,$2)',[prior.hash,prior.folderMillis]);
 const history=await rows(pg,'SELECT * FROM drizzle.__drizzle_migrations');
 const apply=()=>db.dialect.migrate([migrations[migrationIndex]],db.session,{migrationsSchema:'drizzle'});
 await assert.rejects(apply());
 assert.equal((await rows(pg,"SELECT to_regclass('public.meal_template_references') AS relation"))[0].relation,null);
 assert.deepEqual(await rows(pg,'SELECT * FROM meal_templates'),before);
 assert.deepEqual(await rows(pg,'SELECT * FROM drizzle.__drizzle_migrations'),history);
 // Explicit fixture repair only, not automatic production cleanup or migration repair.
 await pg.query('UPDATE meal_templates SET owner_id=$1 WHERE id=$2',[owner,request]);
 await apply();
 assert.deepEqual(await rows(pg,'SELECT * FROM meal_template_references'),[{id:request,owner_id:owner,deleted:false}]);
 assert.equal((await rows(pg,'SELECT * FROM drizzle.__drizzle_migrations')).length,2);
}));
test('template account cascade: injected identity failure restores all rows; successful deletion removes only that owner',async()=>fixture(async({pg,db})=>{
 const removed='00000000-0000-4000-8000-000000000006',otherLive='00000000-0000-4000-8000-000000000007',otherRemoved='00000000-0000-4000-8000-000000000008';
 await createTemplate(db,owner,'Soup',items,request);
 await createTemplate(db,owner,'Removed soup',items,removed);await deleteTemplate(db,owner,removed);
 await createTemplate(db,other,'Other soup',[{role:'main',recipeId:foreign}],otherLive);
 await createTemplate(db,other,'Other removed soup',[{role:'main',recipeId:foreign}],otherRemoved);await deleteTemplate(db,other,otherRemoved);
 const tables=['users','recipes','pantry_items','meal_templates','meal_template_items','meal_template_references'];
 const snapshot=async()=>Object.fromEntries(await Promise.all(tables.map(async table=>[table,await rows(pg,`SELECT * FROM ${table} ORDER BY 1,2`)])));
 const before=await snapshot();
 await pg.exec(`CREATE FUNCTION reject_identity_cascade() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture identity cascade failure'; END $$; CREATE TRIGGER reject_identity_cascade BEFORE DELETE ON meal_template_references FOR EACH ROW EXECUTE FUNCTION reject_identity_cascade();`);
 await assert.rejects(pg.query('DELETE FROM users WHERE id=$1',[owner]));
 assert.deepEqual(await snapshot(),before);
 await pg.exec('DROP TRIGGER reject_identity_cascade ON meal_template_references');
 await pg.query('DELETE FROM users WHERE id=$1',[owner]);
 assert.deepEqual(await listTemplates(db,owner),[]);
 assert.equal((await listTemplates(db,other))[0].id,otherLive);
 const surviving=await rows(pg,'SELECT * FROM meal_template_references ORDER BY id');
 assert.deepEqual(surviving,[{id:otherLive,owner_id:other,deleted:false},{id:otherRemoved,owner_id:other,deleted:true}]);
 assert.equal((await rows(pg,'SELECT * FROM recipes'))[0].id,foreign);
 assert.deepEqual(await rows(pg,'SELECT * FROM pantry_items'),[]);
 await assert.rejects(createTemplate(db,owner,'Soup',items,request));
 await assert.rejects(createTemplate(db,other,'Other removed soup',[{role:'main',recipeId:foreign}],otherRemoved));
}));
test('actual account deletion query: food/template identities cascade atomically and photos remain owner-scoped',async()=>fixture(async({pg,db})=>{
 await pg.exec(readFileSync('packages/db/migrations/0015_sad_blonde_phantom.sql','utf8'));
 const subscriptionDDL=readFileSync('packages/db/migrations/0007_stripe.sql','utf8').split('--> statement-breakpoint').find(sql=>sql.includes('ADD COLUMN "stripe_subscription_id"'));
 assert.ok(subscriptionDDL);await pg.exec(subscriptionDDL);
 await pg.exec(readFileSync('packages/db/migrations/0020_food-notes.sql','utf8'));
 await pg.exec(readFileSync('packages/db/migrations/0021_food-note-identities.sql','utf8'));
 await pg.query('UPDATE users SET clerk_id=$1 WHERE id=$2',['fixture-owner-clerk',owner]);
 await pg.query('UPDATE users SET clerk_id=$1 WHERE id=$2',['fixture-other-clerk',other]);
 const ownPhoto={key:'fixture-owner/photo',url:'https://example.test/owner-photo'},otherPhoto={key:'fixture-other/photo',url:'https://example.test/other-photo'};
 await pg.query('UPDATE recipes SET photos=$1::jsonb WHERE id=$2',[JSON.stringify([ownPhoto]),recipe]);
 await pg.query('UPDATE recipes SET photos=$1::jsonb WHERE id=$2',[JSON.stringify([otherPhoto]),foreign]);
 const removed='00000000-0000-4000-8000-000000000006',survivor='00000000-0000-4000-8000-000000000007';
 await createTemplate(db,owner,'Soup',items,request);await createTemplate(db,owner,'Removed soup',items,removed);await deleteTemplate(db,owner,removed);
 await createTemplate(db,other,'Other soup',[{role:'main',recipeId:foreign}],survivor);
 const note={id:request,date:'2026-10-04',title:'Fixture food',portion:null,source:'text'};
 await saveFoodNote(db,owner,note);await saveFoodNote(db,owner,{...note,id:removed});await deleteFoodNote(db,owner,removed);
 await saveFoodNote(db,other,{...note,title:'Other fixture food'});
 assert.deepEqual(await findUserForDeletion(db,'fixture-owner-clerk'),{id:owner,stripeSubscriptionId:null});
 assert.equal(await findUserForDeletion(db,'missing-fixture-clerk'),null);
 const tables=['users','recipes','pantry_items','meal_templates','meal_template_items','meal_template_references','food_log_entries','food_note_references'];
 const snapshot=async()=>Object.fromEntries(await Promise.all(tables.map(async table=>[table,await rows(pg,`SELECT * FROM ${table} ORDER BY 1,2`)])));
 const before=await snapshot();
 await pg.exec(`CREATE FUNCTION reject_account_marker() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture account cleanup failure'; END $$; CREATE TRIGGER reject_account_marker BEFORE DELETE ON food_note_references FOR EACH ROW EXECUTE FUNCTION reject_account_marker();`);
 await assert.rejects(deleteUserById(db,owner));
 assert.deepEqual(await snapshot(),before);
 await pg.exec('DROP TRIGGER reject_account_marker ON food_note_references');
 assert.deepEqual(await deleteUserById(db,owner),{photos:[ownPhoto]});
 assert.equal(await findUserForDeletion(db,'fixture-owner-clerk'),null);
 assert.equal((await findUserForDeletion(db,'fixture-other-clerk')).id,other);
 assert.deepEqual(await listFoodNotes(db,owner,'2026-10-04'),[]);
 assert.equal((await listFoodNotes(db,other,'2026-10-04'))[0].title,'Other fixture food');
 assert.deepEqual(await rows(pg,'SELECT * FROM meal_template_references'),[{id:survivor,owner_id:other,deleted:false}]);
 assert.deepEqual(await rows(pg,'SELECT * FROM food_note_references'),[{user_id:other,id:request,deleted:false}]);
 assert.deepEqual(await deleteUserById(db,owner),{photos:[]});
 assert.deepEqual((await rows(pg,'SELECT photos FROM recipes'))[0].photos,[otherPhoto]);
 await assert.rejects(saveFoodNote(db,owner,note));
}));


// Execute the exact delete function from the historical release-label source.
// Other old module functions/providers are not imported or invoked.
const legacySource=readFileSync('scripts/fixtures/legacy-template-delete.ts.txt','utf8').replace(/\r\n/g,'\n');
// Exact owned source fixture, not dependent on CI's shallow Git history.
assert.equal(createHash('sha256').update(legacySource).digest('hex'),'02e58ec7c405786099fabad7e9b9cf9bfb09febd54c2d4d11015db68432d04bd');
const legacyJs=transformSync(legacySource.replace('export async function','async function')+'\nlegacy.deleteTemplate=deleteTemplate;', {loader:'ts',format:'cjs'});
const legacy={};runInNewContext(legacyJs.code,{legacy,and,eq,schema,isUuid});
test('historical writer delete cannot permit current exact-ID recreation after migration',async()=>fixture(async({pg,db})=>{
 await createTemplate(db,owner,'Soup',items,request);
 assert.equal(await legacy.deleteTemplate(db,other,request),false);
 assert.equal(await legacy.deleteTemplate(db,owner,request),true);
 // Old writer cannot update the ledger, but current create also refuses a
 // retained non-deleted identity whose corresponding grouping is gone.
 assert.deepEqual(await rows(pg,'SELECT * FROM meal_template_references'),[{id:request,owner_id:owner,deleted:false}]);
 await assert.rejects(createTemplate(db,owner,'Soup',items,request));
 assert.deepEqual(await rows(pg,'SELECT * FROM meal_templates'),[]);
 assert.deepEqual(await rows(pg,'SELECT * FROM meal_template_items'),[]);
 assert.equal((await rows(pg,'SELECT * FROM recipes')).length,2);
 assert.equal((await rows(pg,'SELECT * FROM pantry_items')).length,1);
 assert.equal(await createTemplate(db,owner,'Soup',items,'00000000-0000-4000-8000-000000000006'),'00000000-0000-4000-8000-000000000006');
}));

test('old-writer post-migration grouping can still be deleted by the current owner',async()=>fixture(async({pg,db})=>{
 // The historical creator inserts a fresh grouping/items without a ledger.
 await pg.query(`INSERT INTO meal_templates(id,owner_id,name) VALUES ($1,$2,'Soup')`,[request,owner]);
 await pg.query(`INSERT INTO meal_template_items(template_id,role,recipe_id) VALUES ($1,'main',$2)`,[request,recipe]);
 assert.deepEqual(await rows(pg,'SELECT * FROM meal_template_references'),[]);
 assert.equal(await deleteTemplate(db,other,request),false);
 assert.equal(await deleteTemplate(db,owner,request),true);
 await assert.rejects(createTemplate(db,owner,'Soup',items,request));
}));

test('legacy adoption neither reserves missing/foreign IDs nor survives failed deletion',async()=>fixture(async({pg,db})=>{
 assert.equal(await deleteTemplate(db,owner,request),false);
 assert.deepEqual(await rows(pg,'SELECT * FROM meal_template_references'),[]);
 await pg.query(`INSERT INTO meal_templates(id,owner_id,name) VALUES ($1,$2,'Soup')`,[request,owner]);
 await pg.query(`INSERT INTO meal_template_items(template_id,role,recipe_id) VALUES ($1,'main',$2)`,[request,recipe]);
 assert.equal(await deleteTemplate(db,other,request),false);
 assert.deepEqual(await rows(pg,'SELECT * FROM meal_template_references'),[]);
 await pg.exec(`CREATE FUNCTION legacy_delete_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture deletion fault'; END $$; CREATE TRIGGER legacy_delete_fault BEFORE DELETE ON meal_template_items FOR EACH ROW EXECUTE FUNCTION legacy_delete_fault();`);
 await assert.rejects(deleteTemplate(db,owner,request));
 assert.deepEqual(await rows(pg,'SELECT * FROM meal_template_references'),[]);
 assert.equal((await rows(pg,'SELECT * FROM meal_templates')).length,1);
 assert.equal((await rows(pg,'SELECT * FROM meal_template_items')).length,1);
 await pg.exec('DROP TRIGGER legacy_delete_fault ON meal_template_items');
 assert.equal(await deleteTemplate(db,owner,request),true);
 assert.deepEqual(await rows(pg,'SELECT * FROM meal_template_references'),[{id:request,owner_id:owner,deleted:true}]);
}));
