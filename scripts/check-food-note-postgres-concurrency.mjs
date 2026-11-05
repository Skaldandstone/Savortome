// Actual query contention on CI's disposable, fully migrated PostgreSQL schema.
// This cannot connect to hosted/customer databases.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {saveFoodNote,deleteFoodNote,listFoodNotes} from '../packages/db/src/queries/food-log.ts';
import * as schema from '../packages/db/src/schema.ts';
const url=new URL(process.env.DATABASE_URL??'http://not-configured');
assert.equal(process.env.CI,'true');
assert.ok(['postgresql:','postgres:'].includes(url.protocol));
assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
assert.equal(url.pathname,'/savortome_ci');
assert.equal(url.username,'postgres');
assert.equal(url.search,'');assert.equal(url.hash,'');
assert.ok(url.port===''||url.port==='5432');
const require=createRequire(new URL('../packages/db/package.json',import.meta.url));
const {Client}=require('pg'),{drizzle}=require('drizzle-orm/node-postgres');
const clients=Array.from({length:3},(_,i)=>new Client({connectionString:url.href,ssl:false,application_name:'savortome-note-fixture-'+i,connectionTimeoutMillis:5000}));
const [a,b,observer]=clients,owner=randomUUID(),other=randomUUID();
let release,held,contender;
try{
 await Promise.all(clients.map(c=>c.connect()));
 await Promise.all(clients.map(c=>c.query("SET statement_timeout='8s'; SET lock_timeout='6s'")));
 const suffix=owner.slice(0,8);
 await observer.query("INSERT INTO users(id,email,handle,display_name) VALUES ($1,$2,$3,'Fixture owner'),($4,$5,$6,'Fixture other')",[owner,suffix+'@example.test','note-'+suffix,other,'other-'+suffix+'@example.test','note-other-'+suffix]);
 const dbA=drizzle(a,{schema}),dbB=drizzle(b,{schema});
 const pid=(await b.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
 // Hold a real mutation's outer transaction, then require an independently
 // observed PostgreSQL lock wait before committing it. No timing-only proof.
 async function contend(first,second){
  let ready;const acquired=new Promise(resolve=>ready=resolve),gate=new Promise(resolve=>release=resolve);
  held=dbA.transaction(async tx=>{await first(tx);ready();await gate;});
  assert.equal(await Promise.race([acquired.then(()=>true),held.then(()=>false)]),true);
  let settled=false;
  contender=second().then(value=>({ok:true,value}),error=>({ok:false,error})).finally(()=>settled=true);
  let blocked=false;
  for(let i=0;i<40;i++){
   const activity=(await observer.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0];
   if(activity?.wait_event_type==='Lock'){blocked=true;break;}
   if(settled)break;
   await new Promise(resolve=>setTimeout(resolve,25));
  }
  assert.equal(blocked,true,'Second writer must wait on the held note identity');
  assert.equal(settled,false);
  release();await held;return await contender;
 }
 const input={id:randomUUID(),date:'2026-10-07',title:'Soup',portion:null,source:'text'};
 // Removal arrives before the delayed new-note request, including absent row.
 const result=await contend(tx=>deleteFoodNote(tx,owner,input.id),()=>saveFoodNote(dbB,owner,input));
 assert.equal(result.ok,false);assert.match(result.error.message,/removed or is unavailable/);
 assert.deepEqual(await listFoodNotes(dbA,owner),[]);
 assert.equal((await saveFoodNote(dbB,other,input)).title,'Soup');
 assert.deepEqual((await observer.query('SELECT user_id,deleted FROM food_note_references WHERE id=$1 ORDER BY user_id',[input.id])).rows.sort((x,y)=>x.user_id.localeCompare(y.user_id)),[{user_id:owner,deleted:true},{user_id:other,deleted:false}].sort((x,y)=>x.user_id.localeCompare(y.user_id)));
 console.log('PASS: independent PostgreSQL delete-before-create identity lock and tenant isolation');
 // Two reviewed edits start from the same revision; only the first commits.
 const editInput={...input,id:randomUUID()},first=await saveFoodNote(dbA,owner,editInput);
 let accepted;
 const stale=await contend(async tx=>{accepted=await saveFoodNote(tx,owner,{...editInput,title:'Rice',expectedUpdatedAt:first.updatedAt});},()=>saveFoodNote(dbB,owner,{...editInput,title:'Toast',expectedUpdatedAt:first.updatedAt}));
 assert.equal(stale.ok,false);assert.match(stale.error.message,/changed since review/);
 assert.deepEqual(await listFoodNotes(dbB,owner),[accepted]);
 assert.ok(accepted.updatedAt>first.updatedAt);
 assert.deepEqual(await saveFoodNote(dbB,owner,{...editInput,title:'Rice',expectedUpdatedAt:first.updatedAt}),accepted);
 console.log('PASS: independent PostgreSQL conflicting reviewed edits preserve first revision and exact retry');
 // A retained edit also cannot recreate a row after a committed deletion.
 const removed=await contend(tx=>deleteFoodNote(tx,owner,editInput.id),()=>saveFoodNote(dbB,owner,{...editInput,title:'Later',expectedUpdatedAt:accepted.updatedAt}));
 assert.equal(removed.ok,false);assert.match(removed.error.message,/removed or is unavailable/);
 assert.deepEqual(await listFoodNotes(dbA,owner),[]);
 assert.deepEqual((await listFoodNotes(dbB,other)).map(n=>n.title),['Soup']);
 console.log('PASS: independent PostgreSQL delete-before-edit prevents resurrection');
}finally{
 release?.();await held?.catch(()=>{});await contender?.catch(()=>{});
 // Only invocation-generated synthetic owners are removed, never whole tables.
 try{await observer.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[[owner,other]]);}finally{await Promise.allSettled(clients.map(c=>c.end()));}
}
