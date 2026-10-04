// Real template queries + exact migration 0010 on disposable, partial PGlite.
// Minimal recipe projection deliberately excludes pgvector/full schema bootstrap.
// No DATABASE_URL, hosted data, provider calls or multi-connection proof.
// node --import ./packages/db/node_modules/tsx/dist/loader.mjs scripts/check-template-recovery.mjs
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {createTemplate,renameTemplate,deleteTemplate,listTemplates} from '../packages/db/src/queries/templates.ts';
import * as schema from '../packages/db/src/schema.ts';
const require=createRequire(new URL('../packages/db/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');
const {drizzle}=require('drizzle-orm/pglite');
const owner='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const recipe='00000000-0000-4000-8000-000000000003',foreign='00000000-0000-4000-8000-000000000004';
const request='00000000-0000-4000-8000-000000000005';
const initial=readFileSync('packages/db/migrations/0000_initial_schema.sql','utf8');
const tableDDL=name=>{const sql=initial.split('--> statement-breakpoint').find(s=>s.includes(`CREATE TABLE "${name}"`));assert.ok(sql);return sql;};
async function fixture(run){
 const pg=new PGlite();
 try{
  await pg.exec(`CREATE TYPE visibility AS ENUM ('private','friends','public');`+tableDDL('users')+tableDDL('pantry_items'));
  await pg.exec(`CREATE TABLE recipes(id uuid PRIMARY KEY,owner_id uuid NOT NULL REFERENCES users(id),title text NOT NULL,image_url text,visibility visibility NOT NULL DEFAULT 'private');`);
  await pg.exec(readFileSync('packages/db/migrations/0010_meal-templates.sql','utf8'));
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
 await pg.exec('DROP TRIGGER reject_item ON meal_template_items');
 assert.equal(await createTemplate(db,owner,'Soup',items,request),request);
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
