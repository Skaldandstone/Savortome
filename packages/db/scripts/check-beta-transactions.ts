import assert from 'node:assert/strict';
import pg from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {eq} from 'drizzle-orm';
import {randomUUID} from 'node:crypto';
import {emptyDraft,ingredientFromLine,type Recipe} from '@seconds/core';
import {connectionOptions} from '../src/connection.js';
import * as schema from '../src/schema.js';
import {createRecipe,updateRecipe,saveRecipe,getRecipe,deleteRecipe,setRecipeNutrition,recanonicalizeRecipes} from '../src/queries/recipes.js';
import {requireBetaDatabaseUrl} from './beta-database.js';
const url=requireBetaDatabaseUrl(process.env.DATABASE_URL);
const pool=new pg.Pool(connectionOptions(url)); const database=drizzle(pool,{schema});
const id=randomUUID();const other=randomUUID();
// UUID-derived identifier and owner predicate restrict injection to this run.
const injection=`beta_fail_${id.replaceAll('-','')}`;
const draft={...emptyDraft(),title:'Beta rollback original',ingredients:[ingredientFromLine('1 apple')],steps:[{n:1,text:'Slice the apple.',timerSeconds:null,sourceTimestamp:null}]};
const snapshot=async(ownerId:string)=>({
  recipes:(await pool.query('SELECT row_to_json(r) AS row FROM recipes r WHERE owner_id = $1 ORDER BY id',[ownerId])).rows,
  index:(await pool.query('SELECT ri.* FROM recipe_ingredients ri JOIN recipes r ON r.id = ri.recipe_id WHERE r.owner_id = $1 ORDER BY ri.recipe_id, ri.canonical_item',[ownerId])).rows,
});
const injected=(error:unknown):boolean=>{
  for(let cause=error;cause instanceof Error;cause=cause.cause) {
    if(cause.message.includes('beta injected index failure')) return true;
  }
  return false;
};
let scenarios=0;
const pass=(message:string)=>{scenarios++;console.log(`PASS ${message}`);};
try {
  await database.insert(schema.users).values([{id,email:`${id}@test.invalid`,handle:`beta-${id}`,displayName:'Disposable beta cook'},{id:other,email:`${other}@test.invalid`,handle:`beta-${other}`,displayName:'Other disposable cook'}]);
  await pool.query(`CREATE FUNCTION ${injection}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    IF NEW.canonical_item = 'rollback ingredient' AND EXISTS (SELECT 1 FROM recipes WHERE id = NEW.recipe_id AND owner_id = '${id}')
    THEN RAISE EXCEPTION 'beta injected index failure'; END IF; RETURN NEW; END $$`);
  await pool.query(`CREATE TRIGGER ${injection} BEFORE INSERT ON recipe_ingredients FOR EACH ROW EXECUTE FUNCTION ${injection}()`);
  const bad={...draft,title:'Beta must roll back',ingredients:[ingredientFromLine('rollback ingredient')]};
  const empty=await snapshot(id);
  await assert.rejects(()=>createRecipe(database,id,bad),injected);
  assert.deepEqual(await snapshot(id),empty);
  pass('manual creation rolls back the recipe and ingredient index after an injected indexing failure');
  const recipeId=await createRecipe(database,id,draft);
  const original=await snapshot(id);
  await assert.rejects(()=>updateRecipe(database,id,recipeId,bad),injected);
  assert.deepEqual(await snapshot(id),original);
  pass('edit rollback preserves the entire original row, timestamps and ingredient index');
  const imported:Recipe={...draft,id:randomUUID(),confidence:1,extractionNotes:[],ingredientNutritionGuesses:[],nutrition:null,source:{kind:'web',url:'https://example.invalid/beta-rollback',author:null,siteName:null,extractionMethod:'schema-org'}};
  await assert.rejects(()=>saveRecipe(database,id,{...imported,...bad}),injected);
  assert.deepEqual(await snapshot(id),original);
  pass('new import rolls back its row and index');

  const importedId=await saveRecipe(database,id,imported);
  const beforeReimport=await snapshot(id);
  await assert.rejects(()=>saveRecipe(database,id,{...imported,...bad}),injected);
  assert.deepEqual(await snapshot(id),beforeReimport);
  pass('failed source-URL upsert preserves the previous import and index');
  assert.equal(await saveRecipe(database,id,{...imported,title:'Successful reimport'}),importedId);
  assert.equal((await getRecipe(database,id,importedId))?.title,'Successful reimport');
  assert.equal((await snapshot(id)).recipes.length,2);
  pass('successful source-URL upsert keeps the same recipe ID without duplicating it');

  const otherId=await saveRecipe(database,other,imported);
  assert.notEqual(otherId,importedId);
  const otherBeforeIsolation=await snapshot(other);
  assert.equal(await updateRecipe(database,other,recipeId,draft),false);
  assert.equal(await getRecipe(database,other,recipeId),undefined);
  assert.equal(await deleteRecipe(database,other,recipeId),false);
  assert.equal(await setRecipeNutrition(database,other,recipeId,null),false);
  await saveRecipe(database,id,{...imported,title:'Owner-only update'});
  assert.deepEqual(await snapshot(other),otherBeforeIsolation);
  assert.equal((await getRecipe(database,id,recipeId))?.title,draft.title);
  pass('same source URL stays account-scoped and another user cannot read, edit, delete or alter nutrition');

  const beforeOuter=await snapshot(id);
  await assert.rejects(()=>database.transaction(async tx=>{
    await createRecipe(tx,id,{...draft,title:'Outer transaction must roll back'});
    await saveRecipe(tx,id,{...imported,ingredients:[]});
    throw new Error('beta outer rollback');
  }),/beta outer rollback/);
  assert.deepEqual(await snapshot(id),beforeOuter);
  pass('nested successful writes and empty-index deletion obey the caller transaction rollback');

  let recoveredId='';
  await database.transaction(async tx=>{
    await assert.rejects(()=>createRecipe(tx,id,bad),injected);
    recoveredId=await createRecipe(tx,id,{...draft,title:'Recovered outer transaction'});
  });
  assert.equal((await getRecipe(database,id,recoveredId))?.title,'Recovered outer transaction');
  assert.equal((await snapshot(id)).recipes.length,beforeOuter.recipes.length+1);
  pass('a failed inner savepoint can be caught without poisoning the outer transaction');

  const staleIngredients=[{...ingredientFromLine('rollback ingredient'),canonicalItem:'stale canonical item'}];
  const staleImport={...imported,ingredients:staleIngredients,source:{...imported.source,url:'https://example.invalid/beta-recanonicalize'}};
  const staleId=await saveRecipe(database,id,staleImport);
  const otherStaleId=await saveRecipe(database,other,staleImport);
  const beforeRecanonicalize=await snapshot(id);
  const otherBeforeRecanonicalize=await snapshot(other);
  await assert.rejects(()=>recanonicalizeRecipes(database,id),injected);
  assert.deepEqual(await snapshot(id),beforeRecanonicalize);
  assert.deepEqual(await snapshot(other),otherBeforeRecanonicalize);
  pass('failed recanonicalization restores all owner rows and indexes and leaves the other account untouched');

  await pool.query(`DROP TRIGGER ${injection} ON recipe_ingredients`);
  const result=await recanonicalizeRecipes(database,id);
  assert.equal(result.recipes,beforeRecanonicalize.recipes.length);
  assert.equal(result.changed,1);
  assert.equal((await getRecipe(database,id,staleId))?.ingredients[0]?.canonicalItem,'rollback ingredient');
  assert.deepEqual((await database.query.recipeIngredients.findMany({where:eq(schema.recipeIngredients.recipeId,staleId)})).map(x=>x.canonicalItem),['rollback ingredient']);
  assert.equal((await getRecipe(database,other,otherStaleId))?.ingredients[0]?.canonicalItem,'stale canonical item');
  assert.deepEqual(await snapshot(other),otherBeforeRecanonicalize);
  pass('successful recanonicalization updates the matching owner row and index only');
  console.log(`PASS ${scenarios} transaction/account-isolation scenarios`);
} finally {
  try {
    await pool.query(`DROP TRIGGER IF EXISTS ${injection} ON recipe_ingredients`);
    await pool.query(`DROP FUNCTION IF EXISTS ${injection}()`);
    await database.delete(schema.users).where(eq(schema.users.id,id));
    await database.delete(schema.users).where(eq(schema.users.id,other));
  } finally { await pool.end(); }
}
