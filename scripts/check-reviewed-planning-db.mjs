// Actual queries, disposable PGlite partial schema. No hosted/provider data.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {addToPlan,planForRange,removeFromPlan,clearPlanRange} from '../packages/db/src/queries/plan.ts';
import {addItemsToList,getShoppingList,setItemChecked,removeListItem} from '../packages/db/src/queries/shopping.ts';
import * as schema from '../packages/db/src/schema.ts';
const require=createRequire(new URL('../packages/db/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');const {drizzle}=require('drizzle-orm/pglite');
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';
const RA='00000000-0000-4000-8000-000000000003',RB='00000000-0000-4000-8000-000000000004';
const sql=name=>readFileSync(new URL('../packages/db/migrations/'+name,import.meta.url),'utf8');
test('reviewed planning/shopping real-query retry and owner boundaries',async t=>{
 const pg=new PGlite();try{
  await pg.exec(`CREATE TABLE users(id uuid PRIMARY KEY);INSERT INTO users VALUES ('${A}'),('${B}');
   CREATE TABLE recipes(id uuid PRIMARY KEY,owner_id uuid NOT NULL REFERENCES users(id),title text NOT NULL,image_url text,total_minutes integer);
   INSERT INTO recipes(id,owner_id,title) VALUES ('${RA}','${A}','Synthetic soup'),('${RB}','${B}','Other soup');
   CREATE TABLE pantry_items(user_id uuid REFERENCES users(id),canonical_item text,display_name text NOT NULL,quantity real,unit text,is_staple boolean NOT NULL DEFAULT false,updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(user_id,canonical_item));`);
  // Selected exact initial shopping statements; all other baseline DDL is synthetic.
  const initial=sql('0000_initial_schema.sql');
  for(const table of ['shopping_lists','shopping_list_items']){const statement=initial.match(new RegExp('CREATE TABLE "'+table+'" \\([\\s\\S]*?\\n\\);'));assert.ok(statement);await pg.exec(statement[0]);}
  for(const line of initial.split('\n').filter(line=>line.startsWith('ALTER TABLE "shopping_list')&&line.includes('FOREIGN KEY')))await pg.exec(line.replace('--> statement-breakpoint',''));
  for(const name of ['0001_shopping_list_item_unique.sql','0005_meal_plan.sql','0018_loose_switch.sql','0019_nosy_warstar.sql'])await pg.exec(sql(name));
  const db=drizzle(pg,{schema});
  await t.test('identical reviewed meal retry preserves one row and its creation receipt',async()=>{
   assert.equal(await addToPlan(db,A,RA,'2026-10-05','dinner'),true);const first=await pg.query('SELECT * FROM meal_plan_entries');assert.equal(await addToPlan(db,A,RA,'2026-10-05','dinner'),true);assert.deepEqual((await pg.query('SELECT * FROM meal_plan_entries')).rows,first.rows);assert.equal((await planForRange(db,A,'2026-10-05','2026-10-11')).length,1);
  });
  await t.test('foreign recipe cannot be planned and owner reads cannot reveal another plan',async()=>{
   assert.equal(await addToPlan(db,A,RB,'2026-10-05','dinner'),false);assert.equal(await addToPlan(db,B,RB,'2026-10-05','dinner'),true);const rows=await planForRange(db,A,'2026-10-05','2026-10-11');assert.deepEqual(rows.map(x=>x.recipeId),[RA]);
  });
  await t.test('foreign removal and range clear leave owner calendar unchanged',async()=>{
   await removeFromPlan(db,B,RA,'2026-10-05','dinner');await clearPlanRange(db,B,'2026-10-05','2026-10-11');assert.equal((await planForRange(db,A,'2026-10-05','2026-10-11')).length,1);
  });
  let list,line;
  await t.test('shopping exact retry preserves ID, quantity, unit, recipe references and checked state',async()=>{
   list=await addItemsToList(db,A,[{canonicalItem:'banana',displayName:'Bananas'}]);line=list.items[0];await pg.query('UPDATE shopping_list_items SET quantity=6,unit=$1,checked=true,recipe_ids=$2 WHERE id=$3',['count',[RA],line.id]);const retry=await addItemsToList(db,A,[{canonicalItem:'banana',displayName:'Bananas'}]);assert.equal(retry.id,list.id);assert.equal(retry.items.length,1);assert.equal(retry.items[0].id,line.id);assert.equal(retry.items[0].quantity,6);assert.equal(retry.items[0].unit,'count');assert.equal(retry.items[0].checked,true);assert.deepEqual(retry.items[0].recipeIds,[RA]);
  });
  await t.test('another account cannot read, check or remove the owner shopping line',async()=>{
   assert.equal(await getShoppingList(db,B,list.id),null);await setItemChecked(db,B,line.id,false);await removeListItem(db,B,line.id);const own=await getShoppingList(db,A,list.id);assert.equal(own.items.length,1);assert.equal(own.items[0].checked,true);const other=await addItemsToList(db,B,[{canonicalItem:'banana'}]);assert.notEqual(other.id,list.id);assert.equal(other.items[0].quantity,null);
  });
  await t.test('overlapping first shopping additions share one owner destination',async()=>{
   const C='00000000-0000-4000-8000-000000000005';await pg.query('INSERT INTO users VALUES ($1)',[C]);
   const [one,two]=await Promise.all([addItemsToList(db,C,[{canonicalItem:'synthetic rice'}]),addItemsToList(db,C,[{canonicalItem:'synthetic beans'}])]);
   const lists=await pg.query('SELECT id FROM shopping_lists WHERE user_id=$1',[C]);assert.equal(lists.rows.length,1);assert.equal(one.id,two.id);const saved=await getShoppingList(db,C,one.id);assert.deepEqual(saved.items.map(x=>x.canonicalItem).sort(),['synthetic beans','synthetic rice']);
  });
  await t.test('outer fault rolls back both calendar and shopping additions',async()=>{
   await assert.rejects(db.transaction(async tx=>{await addToPlan(tx,A,RA,'2026-10-06','lunch');await addItemsToList(tx,A,[{canonicalItem:'synthetic oats'}]);throw Error('synthetic fault after both writes');}),/synthetic fault/);assert.equal((await planForRange(db,A,'2026-10-05','2026-10-11')).length,1);assert.deepEqual((await getShoppingList(db,A,list.id)).items.map(x=>x.canonicalItem),['banana']);
  });
 }finally{await pg.close();}
});
