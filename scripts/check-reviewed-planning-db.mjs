// Actual queries, disposable PGlite partial schema. No hosted/provider data.
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {addToPlan,planForRange,removeFromPlan,clearPlanRange} from '../packages/db/src/queries/plan.ts';
import {addRecipesToList,addItemsToList,getShoppingList,setItemChecked,removeListItem} from '../packages/db/src/queries/shopping.ts';
import * as schema from '../packages/db/src/schema.ts';
const require=createRequire(new URL('../packages/db/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');const {drizzle}=require('drizzle-orm/pglite');
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';
const RA='00000000-0000-4000-8000-000000000003',RB='00000000-0000-4000-8000-000000000004';
const sql=name=>readFileSync(new URL('../packages/db/migrations/'+name,import.meta.url),'utf8');
test('reviewed planning/shopping real-query retry and owner boundaries',async t=>{
 const pg=new PGlite();try{
  await pg.exec(`CREATE TABLE users(id uuid PRIMARY KEY);INSERT INTO users VALUES ('${A}'),('${B}');
   CREATE TABLE recipes(id uuid PRIMARY KEY,owner_id uuid NOT NULL REFERENCES users(id),title text NOT NULL,image_url text,total_minutes integer,ingredients jsonb NOT NULL DEFAULT '[]');
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
  await t.test('foreign or empty recipe selection cannot rebuild existing shopping amounts',async()=>{
   await pg.query('INSERT INTO pantry_items(user_id,canonical_item,display_name,quantity,unit) VALUES ($1,$2,$3,$4,$5)',[A,'banana','Bananas',2,'count']);
   const before=(await pg.query('SELECT * FROM shopping_list_items WHERE list_id=$1 ORDER BY id',[list.id])).rows;
   const foreign=await addRecipesToList(db,A,[RB]);assert.equal(foreign.items[0].quantity,6);assert.deepEqual((await pg.query('SELECT * FROM shopping_list_items WHERE list_id=$1 ORDER BY id',[list.id])).rows,before);
   await addRecipesToList(db,A,[]);assert.deepEqual((await pg.query('SELECT * FROM shopping_list_items WHERE list_id=$1 ORDER BY id',[list.id])).rows,before);
  });
  await t.test('owned recipe selection still adds its pantry shortfall',async()=>{
   const D='00000000-0000-4000-8000-000000000006',RD='00000000-0000-4000-8000-000000000007';await pg.query('INSERT INTO users VALUES ($1)',[D]);
   const ingredient={raw:'3 carrots',quantity:3,quantityMax:null,unit:'count',item:'carrot',canonicalItem:'carrot',notes:null,optional:false,group:null};
   await pg.query('INSERT INTO recipes(id,owner_id,title,ingredients) VALUES ($1,$2,$3,$4)',[RD,D,'Synthetic carrots',JSON.stringify([ingredient])]);await pg.query('INSERT INTO pantry_items(user_id,canonical_item,display_name,quantity,unit) VALUES ($1,$2,$3,$4,$5)',[D,'carrot','Carrots',1,'count']);
   const added=await addRecipesToList(db,D,[RD]);assert.equal(added.items.length,1);assert.equal(added.items[0].quantity,2);assert.equal(added.items[0].unit,'count');assert.deepEqual(added.items[0].recipeIds,[RD]);
  });
  await t.test('adding another recipe retains shared and untouched recipe explanations',async()=>{
   const E='00000000-0000-4000-8000-000000000008',RE='00000000-0000-4000-8000-000000000009',RF='00000000-0000-4000-8000-000000000010';await pg.query('INSERT INTO users VALUES ($1)',[E]);
   const ingredient=(item,quantity)=>({raw:item,quantity,quantityMax:null,unit:'count',item,canonicalItem:item,notes:null,optional:false,group:null});
   await pg.query('INSERT INTO recipes(id,owner_id,title,ingredients) VALUES ($1,$2,$3,$4),($5,$2,$6,$7)',[RE,E,'Synthetic first',JSON.stringify([ingredient('carrot',3),ingredient('oat',2)]),RF,'Synthetic second',JSON.stringify([ingredient('carrot',1)])]);
   const first=await addRecipesToList(db,E,[RE],{usePantry:false,skipStaples:false});await setItemChecked(db,E,first.items.find(x=>x.canonicalItem==='oat').id,true);
   const second=await addRecipesToList(db,E,[RF],{usePantry:false,skipStaples:false});const carrot=second.items.find(x=>x.canonicalItem==='carrot'),oat=second.items.find(x=>x.canonicalItem==='oat');
   assert.equal(carrot.id,first.items.find(x=>x.canonicalItem==='carrot').id);assert.equal(oat.id,first.items.find(x=>x.canonicalItem==='oat').id);assert.equal(carrot.quantity,4);assert.deepEqual(carrot.recipeIds.slice().sort(),[RE,RF].sort());assert.equal(oat.quantity,2);assert.deepEqual(oat.recipeIds,[RE]);assert.equal(oat.checked,true);assert.equal(second.items.some(x=>x.recipeIds.includes('__existing__')),false);
  });
  await t.test('later recipe additions do not subtract pantry twice from saved shortfalls',async()=>{
   const F='00000000-0000-4000-8000-000000000011',RG='00000000-0000-4000-8000-000000000012',RH='00000000-0000-4000-8000-000000000013';await pg.query('INSERT INTO users VALUES ($1)',[F]);
   const ingredient=(item,quantity)=>({raw:item,quantity,quantityMax:null,unit:'count',item,canonicalItem:item,notes:null,optional:false,group:null});
   await pg.query('INSERT INTO recipes(id,owner_id,title,ingredients) VALUES ($1,$2,$3,$4),($5,$2,$6,$7)',[RG,F,'Synthetic first shortfall',JSON.stringify([ingredient('carrot',3),ingredient('oat',2)]),RH,'Synthetic next shortfall',JSON.stringify([ingredient('carrot',3),ingredient('banana',3)])]);
   await pg.query('INSERT INTO pantry_items(user_id,canonical_item,display_name,quantity,unit) VALUES ($1,$2,$2,$3,$4),($1,$5,$5,$3,$4)',[F,'carrot',1,'count','banana']);
   const first=await addRecipesToList(db,F,[RG],{skipStaples:false});assert.equal(first.items.find(x=>x.canonicalItem==='carrot').quantity,2);
   await pg.query('INSERT INTO pantry_items(user_id,canonical_item,display_name,quantity,unit) VALUES ($1,$2,$2,$3,$4)',[F,'oat',100,'count']);
   const second=await addRecipesToList(db,F,[RH],{skipStaples:false});assert.equal(second.items.find(x=>x.canonicalItem==='carrot').quantity,5);assert.equal(second.items.find(x=>x.canonicalItem==='banana').quantity,2);assert.equal(second.items.find(x=>x.canonicalItem==='oat').quantity,2);
  });
  await t.test('overlapping recipe additions retain both shopping contributions',async()=>{
   const G='00000000-0000-4000-8000-000000000014',RI='00000000-0000-4000-8000-000000000015',RJ='00000000-0000-4000-8000-000000000016';await pg.query('INSERT INTO users VALUES ($1)',[G]);
   const ingredient=item=>({raw:item,quantity:2,quantityMax:null,unit:'count',item,canonicalItem:item,notes:null,optional:false,group:null});
   await pg.query('INSERT INTO recipes(id,owner_id,title,ingredients) VALUES ($1,$2,$3,$4),($5,$2,$6,$7)',[RI,G,'Synthetic concurrent carrots',JSON.stringify([ingredient('carrot')]),RJ,'Synthetic concurrent beans',JSON.stringify([ingredient('bean')])]);
   await addItemsToList(db,G,[{canonicalItem:'banana'}]);
   await Promise.all([addRecipesToList(db,G,[RI],{usePantry:false}),addRecipesToList(db,G,[RJ],{usePantry:false})]);
   const lists=(await pg.query('SELECT id FROM shopping_lists WHERE user_id=$1',[G])).rows;assert.equal(lists.length,1);const saved=await getShoppingList(db,G,lists[0].id);assert.deepEqual(saved.items.map(x=>x.canonicalItem).sort(),['banana','bean','carrot']);
   const RK='00000000-0000-4000-8000-000000000017';await pg.query('INSERT INTO recipes(id,owner_id,title,ingredients) VALUES ($1,$2,$3,$4)',[RK,G,'Synthetic concurrent tomato',JSON.stringify([ingredient('tomato')])]);
   await Promise.all([addRecipesToList(db,G,[RK],{usePantry:false}),addItemsToList(db,G,[{canonicalItem:'melon'}])]);assert.deepEqual((await getShoppingList(db,G,lists[0].id)).items.map(x=>x.canonicalItem).sort(),['banana','bean','carrot','melon','tomato']);

  });
  await t.test('overlapping first shopping additions share one owner destination',async()=>{
   const C='00000000-0000-4000-8000-000000000005';await pg.query('INSERT INTO users VALUES ($1)',[C]);
   const [one,two]=await Promise.all([addItemsToList(db,C,[{canonicalItem:'synthetic rice'}]),addItemsToList(db,C,[{canonicalItem:'synthetic beans'}])]);
   const lists=await pg.query('SELECT id FROM shopping_lists WHERE user_id=$1',[C]);assert.equal(lists.rows.length,1);assert.equal(one.id,two.id);const saved=await getShoppingList(db,C,one.id);assert.deepEqual(saved.items.map(x=>x.canonicalItem).sort(),['synthetic beans','synthetic rice']);
  });
  await t.test('failed recipe insertion restores saved rows and first-list creation, then permits retry',async()=>{
   const H='00000000-0000-4000-8000-000000000018',I='00000000-0000-4000-8000-000000000019',RL='00000000-0000-4000-8000-000000000020',RM='00000000-0000-4000-8000-000000000021';await pg.query('INSERT INTO users VALUES ($1),($2)',[H,I]);
   const ingredient={raw:'synthetic rejected item',quantity:2,quantityMax:null,unit:'count',item:'synthetic rejected item',canonicalItem:'synthetic rejected item',notes:null,optional:false,group:null};
   await pg.query('INSERT INTO recipes(id,owner_id,title,ingredients) VALUES ($1,$2,$3,$4),($5,$6,$3,$4)',[RL,H,'Synthetic insertion fault',JSON.stringify([ingredient]),RM,I]);
   const original=await addItemsToList(db,H,[{canonicalItem:'banana'}]);await pg.query('UPDATE shopping_list_items SET quantity=6,unit=$1,checked=true,recipe_ids=$2 WHERE list_id=$3',['count',[RL],original.id]);
   const before=(await pg.query('SELECT * FROM shopping_list_items ORDER BY id')).rows;
   await pg.exec(`CREATE FUNCTION reject_synthetic_shopping_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.canonical_item = 'synthetic rejected item' THEN RAISE EXCEPTION 'synthetic insertion fault'; END IF; RETURN NEW; END $$; CREATE TRIGGER synthetic_shopping_fault BEFORE INSERT ON shopping_list_items FOR EACH ROW EXECUTE FUNCTION reject_synthetic_shopping_insert();`);
   try{
    const failed=error=>/synthetic insertion fault/.test(error.cause?.message??error.message);
    await assert.rejects(addRecipesToList(db,H,[RL],{usePantry:false}),failed);assert.deepEqual((await pg.query('SELECT * FROM shopping_list_items ORDER BY id')).rows,before);
    await assert.rejects(addRecipesToList(db,I,[RM],{usePantry:false}),failed);assert.equal((await pg.query('SELECT id FROM shopping_lists WHERE user_id=$1',[I])).rows.length,0);assert.deepEqual((await pg.query('SELECT * FROM shopping_list_items ORDER BY id')).rows,before);
   }finally{await pg.exec('DROP TRIGGER synthetic_shopping_fault ON shopping_list_items; DROP FUNCTION reject_synthetic_shopping_insert();');}
   const retry=await addRecipesToList(db,H,[RL],{usePantry:false});assert.equal(retry.id,original.id);const banana=retry.items.find(x=>x.canonicalItem==='banana');assert.equal(banana.quantity,6);assert.equal(banana.checked,true);assert.deepEqual(banana.recipeIds,[RL]);assert.equal(retry.items.find(x=>x.canonicalItem==='synthetic rejected item').quantity,2);
   const fresh=await addRecipesToList(db,I,[RM],{usePantry:false});assert.equal(fresh.items.length,1);assert.equal(fresh.items[0].quantity,2);
  });
  await t.test('displayed shopping item IDs remain actionable after a recipe addition',async()=>{
   const J='00000000-0000-4000-8000-000000000022',RN='00000000-0000-4000-8000-000000000023';await pg.query('INSERT INTO users VALUES ($1)',[J]);
   const ingredient={raw:'2 tomatoes',quantity:2,quantityMax:null,unit:'count',item:'tomato',canonicalItem:'tomato',notes:null,optional:false,group:null};await pg.query('INSERT INTO recipes(id,owner_id,title,ingredients) VALUES ($1,$2,$3,$4)',[RN,J,'Synthetic displayed shopping IDs',JSON.stringify([ingredient])]);
   const displayed=await addItemsToList(db,J,[{canonicalItem:'carrot'},{canonicalItem:'bean'}]);const carrotId=displayed.items.find(x=>x.canonicalItem==='carrot').id,beanId=displayed.items.find(x=>x.canonicalItem==='bean').id;
   await addRecipesToList(db,J,[RN],{usePantry:false});await setItemChecked(db,J,carrotId,true);await removeListItem(db,J,beanId);
   const current=await getShoppingList(db,J,displayed.id);assert.equal(current.items.find(x=>x.canonicalItem==='carrot').checked,true);assert.equal(current.items.find(x=>x.canonicalItem==='carrot').id,carrotId);assert.equal(current.items.some(x=>x.canonicalItem==='bean'),false);assert.equal(current.items.find(x=>x.canonicalItem==='tomato').quantity,2);
  });
  await t.test('outer fault rolls back both calendar and shopping additions',async()=>{
   await assert.rejects(db.transaction(async tx=>{await addToPlan(tx,A,RA,'2026-10-06','lunch');await addItemsToList(tx,A,[{canonicalItem:'synthetic oats'}]);throw Error('synthetic fault after both writes');}),/synthetic fault/);assert.equal((await planForRange(db,A,'2026-10-05','2026-10-11')).length,1);assert.deepEqual((await getShoppingList(db,A,list.id)).items.map(x=>x.canonicalItem),['banana']);
  });
 }finally{await pg.close();}
});
