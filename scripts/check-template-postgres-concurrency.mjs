// Two independent PostgreSQL writers plus observer, on CI's disposable full schema.
// Refuse arbitrary DATABASE_URLs; never run against hosted/customer data.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {createTemplate,deleteTemplate} from '../packages/db/src/queries/templates.ts';
import * as schema from '../packages/db/src/schema.ts';
const url=new URL(process.env.DATABASE_URL??'http://not-configured');
assert.equal(process.env.CI,'true','This fixture is restricted to disposable CI');
assert.ok(['postgresql:','postgres:'].includes(url.protocol));
assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
assert.equal(url.pathname,'/savortome_ci');
assert.equal(url.username,'postgres');
const require=createRequire(new URL('../packages/db/package.json',import.meta.url));
const {Client}=require('pg'),{drizzle}=require('drizzle-orm/node-postgres');
const clients=Array.from({length:3},(_,i)=>new Client({connectionString:url.href,ssl:false,application_name:'savortome-compat-fixture-'+i,connectionTimeoutMillis:5000}));
const [a,b,observer]=clients;
const owner=randomUUID(),other=randomUUID(),recipe=randomUUID(),request=randomUUID();
const items=[{role:'main',recipeId:recipe}];
let release,held,create;
try{
 await Promise.all(clients.map(c=>c.connect()));
 await Promise.all(clients.map(c=>c.query("SET statement_timeout='8s'; SET lock_timeout='6s'")));
 const suffix=owner.slice(0,8);
 await observer.query("INSERT INTO users(id,email,handle,display_name) VALUES ($1,$2,$3,'Fixture owner'),($4,$5,$6,'Fixture other')",[owner,suffix+'@example.test','compat-'+suffix,other,'other-'+suffix+'@example.test','compat-other-'+suffix]);
 await observer.query("INSERT INTO recipes(id,owner_id,title,ingredients,steps,source_kind,extraction_method) VALUES ($1,$2,'Fixture soup','[]','[]','manual','manual')",[recipe,owner]);
 // Equivalent old creator: a fresh owned grouping after migration backfill,
 // without a reference. No real provider/account/customer records are used.
 await observer.query("INSERT INTO meal_templates(id,owner_id,name) VALUES ($1,$2,'Soup')",[request,owner]);
 await observer.query("INSERT INTO meal_template_items(template_id,role,recipe_id) VALUES ($1,'main',$2)",[request,recipe]);
 const dbA=drizzle(a,{schema}),dbB=drizzle(b,{schema});
 assert.equal(await deleteTemplate(dbB,other,request),false);
 assert.equal((await observer.query('SELECT count(*)::int AS n FROM meal_template_references WHERE id=$1',[request])).rows[0].n,0);
 let ready;const acquired=new Promise(resolve=>ready=resolve),gate=new Promise(resolve=>release=resolve);
 held=dbA.transaction(async tx=>{assert.equal(await deleteTemplate(tx,owner,request),true);ready();await gate;});
 const acquiredResult=await Promise.race([acquired.then(()=>true),held.then(()=>false)]);
 assert.equal(acquiredResult,true);
 const pid=(await b.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
 let settled=false;
 create=createTemplate(dbB,owner,'Soup',items,request).then(value=>({ok:true,value}),error=>({ok:false,error})).finally(()=>settled=true);
 let blocked=false;
 for(let i=0;i<40;i++){
   const activity=(await observer.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0];
   if(activity?.wait_event_type==='Lock'){blocked=true;break;}
   if(settled)break;
   await new Promise(resolve=>setTimeout(resolve,25));
 }
 assert.equal(blocked,true,'Independent create must contend on the held identity');
 assert.equal(settled,false);
 release();await held;
 const result=await create;
 assert.equal(result.ok,false,'Late exact-ID create cannot recreate the deleted grouping');
 assert.match(result.error.message,/cannot be reused/);
 assert.equal((await observer.query('SELECT count(*)::int AS n FROM meal_templates WHERE id=$1',[request])).rows[0].n,0);
 assert.equal((await observer.query('SELECT count(*)::int AS n FROM meal_template_items WHERE template_id=$1',[request])).rows[0].n,0);
 assert.deepEqual((await observer.query('SELECT owner_id,deleted FROM meal_template_references WHERE id=$1',[request])).rows,[{owner_id:owner,deleted:true}]);
 assert.equal((await observer.query('SELECT count(*)::int AS n FROM recipes WHERE id=$1',[recipe])).rows[0].n,1);
 console.log('PASS: independent PostgreSQL legacy-delete adoption/exact-create contention, tombstone and tenant isolation');
}finally{
 release?.();await held?.catch(()=>{});await create?.catch(()=>{});
 // Delete only this invocation's generated synthetic owners; no table truncation.
 try{await observer.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[ [owner,other] ]);}finally{await Promise.allSettled(clients.map(c=>c.end()));}
}
