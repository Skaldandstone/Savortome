// Actual routes, API guard, parsers and queries against disposable PGlite.
// Clerk/session, Next response wrapper and DB factory are synthetic; no live DB.
// node --import ./packages/db/node_modules/tsx/dist/loader.mjs scripts/check-food-note-api.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';
import { saveFoodNote, listFoodNotes, deleteFoodNote } from '../packages/db/src/queries/food-log.ts';
import { FoodLogValidationError } from '../packages/core/src/food-log.ts';
import * as schema from '../packages/db/src/schema.ts';
const require=createRequire(new URL('../packages/db/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite'),{drizzle}=require('drizzle-orm/pglite');
const root=process.cwd().replaceAll('\\','/');
const classes=names=>names.map(name=>`export class ${name} extends Error {}`).join('\n');
const mocks={
 'server-only':'',
 'next/server':'export const NextResponse={json:(body,options)=>new Response(JSON.stringify(body),options)};',
 '@seconds/core':classes(['InstacartError','KrogerError','PantryIntakeValidationError','PantryValidationError','ReceiptExtractionError','RecipeValidationError','ShelfValidationError','BarcodeValidationError','BarcodeLookupError','FoodNoteExtractionError','FriendshipError'])+'export const FoodLogValidationError=state.ValidationError;',
 '@seconds/db':classes(['PantryIntakeNotFoundError','SaveRecipeError','SaveTemplateError','SuggestionError'])+`export const db=()=>state.db;
 export const saveFoodNote=(...args)=>{state.calls.push('save');return state.queries.save(...args);};
 export const listFoodNotes=(...args)=>{state.calls.push('list');return state.queries.list(...args);};
 export const deleteFoodNote=(...args)=>{state.calls.push('delete');return state.queries.remove(...args);};`,
 '@/lib/session':classes(['NotConfiguredError','NotSignedInError'])+'export const databaseConfigured=()=>state.configured;export const requireUserId=async()=>{state.calls.push("auth");if(!state.signedIn)throw new NotSignedInError("Sign in to do that.");return state.owner;};',
};
const bundle=await build({bundle:true,write:false,platform:'node',format:'iife',globalName:'notes',stdin:{resolveDir:process.cwd(),contents:"export {GET,POST,DELETE} from './apps/web/app/api/food-log/route.ts';"},plugins:[{name:'note-api-boundaries',setup(api){
 api.onResolve({filter:/.*/},args=>{
  if(args.path==='./session'||args.path==='./session.js')return{path:'@/lib/session',namespace:'mock'};
  if(Object.hasOwn(mocks,args.path))return{path:args.path,namespace:'mock'};
  if(args.path.startsWith('@/lib/'))return{path:root+'/apps/web/'+args.path.slice(2)+'.ts'};
 });
 api.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js',resolveDir:process.cwd()}));
}}]});
const owner='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002';
const id='20000000-0000-4000-8000-000000000001';
const input={id,date:'2026-10-04',title:'Soup',portion:null,source:'text'};
function fixture(db,user=owner){
 const state={db,owner:user,configured:true,signedIn:true,calls:[],logs:[],ValidationError:FoodLogValidationError,queries:{save:saveFoodNote,list:listFoodNotes,remove:deleteFoodNote}};
 const context={state,Response,URL,TextDecoder,Uint8Array,setTimeout,clearTimeout,console:{error:(...args)=>state.logs.push(args.join(' '))}};
 runInNewContext(bundle.outputFiles[0].text,context);
 const request=(body,headers={})=>{const bytes=Buffer.from(typeof body==='string'?body:JSON.stringify(body));let done=false;return{headers:new Headers(headers),body:{getReader(){state.calls.push('body');return{read:async()=>done?{done:true}:(done=true,{done:false,value:bytes}),cancel:async()=>{}}}}};};
 return{state,api:context.notes,request};
}
async function check(response,status){assert.equal(response.status,status);assert.equal(response.headers.get('cache-control'),'private, no-store');return response.json();}
test('food-note actual-route and disposable-query account boundaries',async t=>{
 const pg=new PGlite();
 try{
  await pg.exec(`CREATE TABLE users(id uuid PRIMARY KEY);INSERT INTO users VALUES('${owner}'),('${other}');`);
  await pg.exec(readFileSync(new URL('../packages/db/migrations/0020_food-notes.sql',import.meta.url),'utf8'));
  await pg.exec(readFileSync(new URL('../packages/db/migrations/0021_food-note-identities.sql',import.meta.url),'utf8'));
  const db=drizzle(pg,{schema});
  await t.test('signed out and missing DB refuse all methods before request access or query',async()=>{
   for(const mode of ['auth','config'])for(const method of ['GET','POST','DELETE']){const f=fixture(db);if(mode==='auth')f.state.signedIn=false;else f.state.configured=false;const req={get url(){throw Error('must not read URL');},get headers(){throw Error('must not read body');}};await check(await f.api[method](req),mode==='auth'?401:501);assert.equal(f.state.calls.some(x=>['body','list','save','delete'].includes(x)),false);}
  });
  await t.test('reviewed save ignores supplied owner and sensitive unknown fields',async()=>{
   const f=fixture(db);const saved=await check(await f.api.POST(f.request({...input,userId:other,user_id:other,base64:'synthetic private media',diagnosis:'synthetic private detail',token:'synthetic token'})),200);
   assert.equal(saved.title,'Soup');assert.deepEqual(Object.keys(saved).sort(),['createdAt','date','id','portion','source','title','updatedAt'].sort());
   assert.deepEqual(await listFoodNotes(db,other),[]);assert.equal((await listFoodNotes(db,owner)).length,1);
  });
  await t.test('GET is session-owned and date filtering validates without leaking another owner',async()=>{
   await saveFoodNote(db,other,{...input,title:'Other account note'});
   const f=fixture(db);const result=await check(await f.api.GET({url:'https://fixture.invalid/api/food-log?userId='+other}),200);assert.deepEqual(result.map(x=>x.title),['Soup']);
   assert.deepEqual(await check(await f.api.GET({url:'https://fixture.invalid/api/food-log?date=2026-10-03'}),200),[]);
   await check(await f.api.GET({url:'https://fixture.invalid/api/food-log?date=2026-02-30'}),400);
  });
  await t.test('stale edit and exact retry preserve original owned contents',async()=>{
   const f=fixture(db),before=(await listFoodNotes(db,owner))[0];await check(await f.api.POST(f.request({...input,title:'Changed without review'})),400);assert.deepEqual((await listFoodNotes(db,owner))[0],before);
   assert.deepEqual(await check(await f.api.POST(f.request(input)),200),before);
  });
  await t.test('malformed and bounded bodies cannot change notes or reserve new identities',async()=>{
   const f=fixture(db),before=await listFoodNotes(db,owner);const count=async()=>Number((await pg.query('SELECT count(*) AS count FROM food_note_references')).rows[0].count);const previous=await count();
   for(const body of ['{',[],{...input,id:'bad-id'},{...input,date:'2026-02-30'},{...input,title:''}])await check(await f.api.POST(f.request(body)),400);
   await check(await f.api.POST(f.request(input,{'content-length':'8193'})),400);
   await check(await f.api.DELETE(f.request({id}, {'content-length':'1025'})),400);
   await check(await f.api.DELETE(f.request({id:42})),400);
   assert.equal(await count(),previous);assert.deepEqual(await listFoodNotes(db,owner),before);
  });
  await t.test('DELETE ignores foreign owner fields and only closes the current owner identity',async()=>{
   const f=fixture(db,other);await check(await f.api.DELETE(f.request({id,userId:owner,user_id:owner})),200);assert.deepEqual(await listFoodNotes(db,other),[]);assert.equal((await listFoodNotes(db,owner))[0].title,'Soup');
   await check(await f.api.POST(f.request({...input,title:'Other account note'})),400);assert.equal((await listFoodNotes(db,owner)).length,1);
  });
  await t.test('failed insert rolls back identity and redacts DB diagnostics at HTTP boundary',async()=>{
   const f=fixture(db),failed={...input,id:'20000000-0000-4000-8000-000000000002'};
   await pg.exec("CREATE FUNCTION fail_api_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic private database diagnostic'; END $$;CREATE TRIGGER fail_api_insert BEFORE INSERT ON food_log_entries FOR EACH ROW EXECUTE FUNCTION fail_api_insert();");
   try{assert.deepEqual(await check(await f.api.POST(f.request(failed)),500),{error:'Something went wrong on our end.'});assert.deepEqual(f.state.logs,['Unhandled food-support API error; details withheld.']);assert.equal(Number((await pg.query('SELECT count(*) AS count FROM food_note_references WHERE id=$1',[failed.id])).rows[0].count),0);}finally{await pg.exec('DROP TRIGGER fail_api_insert ON food_log_entries;DROP FUNCTION fail_api_insert();');}
   assert.equal((await check(await f.api.POST(f.request(failed)),200)).id,failed.id);
  });
  await t.test('failed delete leaves note and marker unchanged, then explicit retry succeeds',async()=>{
   const f=fixture(db),before=(await listFoodNotes(db,owner)).find(note=>note.id===id);
   await pg.exec("CREATE FUNCTION fail_api_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic private delete diagnostic'; END $$;CREATE TRIGGER fail_api_delete BEFORE DELETE ON food_log_entries FOR EACH ROW EXECUTE FUNCTION fail_api_delete();");
   try{assert.deepEqual(await check(await f.api.DELETE(f.request({id})),500),{error:'Something went wrong on our end.'});assert.deepEqual(f.state.logs,['Unhandled food-support API error; details withheld.']);assert.deepEqual((await listFoodNotes(db,owner)).find(note=>note.id===id),before);assert.equal((await pg.query('SELECT deleted FROM food_note_references WHERE user_id=$1 AND id=$2',[owner,id])).rows[0].deleted,false);}finally{await pg.exec('DROP TRIGGER fail_api_delete ON food_log_entries;DROP FUNCTION fail_api_delete();');}
   await check(await f.api.DELETE(f.request({id})),200);await check(await f.api.POST(f.request(input)),400);
  });
  await t.test('removed DB owner cannot recreate notes even with synthetic stale authenticated identity',async()=>{
   await pg.query('DELETE FROM users WHERE id=$1',[owner]);
   const f=fixture(db);assert.deepEqual(await check(await f.api.POST(f.request({...input,id:'20000000-0000-4000-8000-000000000003'})),500),{error:'Something went wrong on our end.'});
   for(const table of ['food_log_entries','food_note_references'])assert.equal(Number((await pg.query(`SELECT count(*) AS count FROM ${table} WHERE user_id=$1`,[owner])).rows[0].count),0);
   assert.deepEqual(f.state.logs,['Unhandled food-support API error; details withheld.']);
  });
 }finally{await pg.close();}
});
