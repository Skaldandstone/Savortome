// Actual cleanup contention on the disposable full-schema CI database.
// This cannot connect to hosted/customer databases.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {processPendingPhotoDeletions} from '../packages/db/src/queries/photo-cleanup.ts';
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
const clients=Array.from({length:3},(_,i)=>new Client({connectionString:url.href,ssl:false,application_name:'savortome-photo-fixture-'+i,connectionTimeoutMillis:5000}));
const [a,b,observer]=clients,owner=randomUUID(),recipe=randomUUID();
const key=`recipes/${owner}/${recipe}/${randomUUID()}.jpg`;
let release,held,processing;
try{
 await Promise.all(clients.map(c=>c.connect()));
 await Promise.all(clients.map(c=>c.query("SET statement_timeout='8s'; SET lock_timeout='6s'")));
 assert.equal((await observer.query('SELECT count(*)::int AS n FROM pending_photo_deletions WHERE retry_after<=CURRENT_TIMESTAMP')).rows[0].n,0,'Disposable fixture requires no pre-existing eligible cleanup batch');
 const suffix=owner.slice(0,8);
 await observer.query("INSERT INTO users(id,email,handle,display_name) VALUES ($1,$2,$3,'Fixture owner')",[owner,suffix+'@example.test','photo-'+suffix]);
 await observer.query("INSERT INTO recipes(id,owner_id,title,ingredients,steps,source_kind,extraction_method) VALUES ($1,$2,'Fixture soup','[]','[]','manual','manual')",[recipe,owner]);
 await observer.query('INSERT INTO pending_photo_deletions(key) VALUES ($1)',[key]);
 const dbA=drizzle(a,{schema}),dbB=drizzle(b,{schema});
 let ready,calls=0;const acquired=new Promise(resolve=>ready=resolve),gate=new Promise(resolve=>release=resolve);
 processing=processPendingPhotoDeletions(dbA,async erased=>{assert.equal(erased,key);calls++;ready();await gate;},{limit:1,timeoutMs:3000});
 assert.equal(await Promise.race([acquired.then(()=>true),processing.then(()=>false)]),true);
 const other=await processPendingPhotoDeletions(dbB,async()=>{throw Error('Second eraser must not receive the locked key');},{limit:1});
 assert.deepEqual(other,{completed:0,failed:0,blocked:0});
 assert.equal(calls,1);
 release();assert.deepEqual(await processing,{completed:1,failed:0,blocked:0});
 assert.equal((await observer.query('SELECT count(*)::int AS n FROM pending_photo_deletions WHERE key=$1',[key])).rows[0].n,0);
 console.log('PASS: independent PostgreSQL cleanup SKIP LOCKED prevents duplicate eraser dispatch');
 // Contending recipe attachment/edit must stop cleanup before storage dispatch.
 await observer.query('INSERT INTO pending_photo_deletions(key) VALUES ($1)',[key]);
 let locked;const lockReady=new Promise(resolve=>locked=resolve),recipeGate=new Promise(resolve=>release=resolve);
 held=dbA.transaction(async tx=>{await tx.execute(require('drizzle-orm').sql`SELECT id FROM recipes WHERE id=${recipe}::uuid FOR UPDATE`);locked();await recipeGate;});
 assert.equal(await Promise.race([lockReady.then(()=>true),held.then(()=>false)]),true);
 let erases=0;
 await assert.rejects(processPendingPhotoDeletions(dbB,async()=>{erases++;}),error=>error.code==='55P03'||error.cause?.code==='55P03');
 assert.equal(erases,0);
 assert.equal((await observer.query('SELECT attempts FROM pending_photo_deletions WHERE key=$1',[key])).rows[0].attempts,0);
 release();await held;
 console.log('PASS: independent PostgreSQL recipe lock conflict retains cleanup identity without erasure');
 // Synthetic eraser failure retains a bounded retry reference; only resolution
 // permits acknowledgement. No actual R2/provider client is imported or called.
 assert.deepEqual(await processPendingPhotoDeletions(dbB,async()=>{throw Error('Synthetic eraser failure');}),{completed:0,failed:1,blocked:0});
 assert.equal((await observer.query('SELECT attempts FROM pending_photo_deletions WHERE key=$1',[key])).rows[0].attempts,1);
 await observer.query("UPDATE pending_photo_deletions SET retry_after=statement_timestamp()-interval '1 second' WHERE key=$1",[key]);
 assert.deepEqual(await processPendingPhotoDeletions(dbB,async erased=>assert.equal(erased,key)),{completed:1,failed:0,blocked:0});
 assert.equal((await observer.query('SELECT count(*)::int AS n FROM pending_photo_deletions WHERE key=$1',[key])).rows[0].n,0);
 console.log('PASS: full-schema PostgreSQL failed erasure retains reference until deliberate successful retry');
}finally{
 release?.();await held?.catch(()=>{});await processing?.catch(()=>{});
 // Pending references deliberately have no owner cascade; remove only the
 // exact generated key as well as this invocation's generated owner.
 try{await observer.query('DELETE FROM pending_photo_deletions WHERE key=$1',[key]);await observer.query('DELETE FROM users WHERE id=$1',[owner]);}finally{await Promise.allSettled(clients.map(c=>c.end()));}
}
