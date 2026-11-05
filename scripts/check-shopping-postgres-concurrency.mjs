// Independent-writer regression checks on the fully migrated disposable CI DB.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {addItemsToList,addRecipesToList,getShoppingList,setItemChecked,removeListItem,clearShoppingList} from '../packages/db/src/queries/shopping.ts';
import * as schema from '../packages/db/src/schema.ts';
const url=new URL(process.env.DATABASE_URL??'http://not-configured');
assert.equal(process.env.CI,'true');
assert.ok(['postgresql:','postgres:'].includes(url.protocol));
assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
assert.equal(url.pathname,'/savortome_ci');assert.equal(url.username,'postgres');
assert.equal(url.search,'');assert.equal(url.hash,'');
assert.ok(url.port===''||url.port==='5432');
const require=createRequire(new URL('../packages/db/package.json',import.meta.url));
const {Client}=require('pg'),{drizzle}=require('drizzle-orm/node-postgres');
const clients=Array.from({length:3},(_,i)=>new Client({connectionString:url.href,ssl:false,application_name:'savortome-shopping-fixture-'+i,connectionTimeoutMillis:5000}));
const [a,b,observer]=clients,owner=randomUUID(),other=randomUUID(),recipe=randomUUID();
let release,rebuilding,mutating;
try{
 await Promise.all(clients.map(c=>c.connect()));
 await Promise.all(clients.map(c=>c.query("SET statement_timeout='8s'; SET lock_timeout='6s'")));
 const suffix=owner.slice(0,8);
 await observer.query("INSERT INTO users(id,email,handle,display_name) VALUES ($1,$2,$3,'Fixture owner'),($4,$5,$6,'Fixture other')",[owner,suffix+'@example.test','shopping-'+suffix,other,'other-'+suffix+'@example.test','shopping-other-'+suffix]);
 const ingredient={raw:'2 tomatoes',quantity:2,quantityMax:null,unit:'count',item:'tomato',canonicalItem:'tomato',notes:null,optional:false,group:null};
 await observer.query("INSERT INTO recipes(id,owner_id,title,ingredients,steps,source_kind,extraction_method) VALUES ($1,$2,'Fixture tomatoes',$3,'[]','manual','manual')",[recipe,owner,JSON.stringify([ingredient])]);
 const dbA=drizzle(a,{schema}),dbB=drizzle(b,{schema});
 const otherList=await addItemsToList(dbB,other,[{canonicalItem:'bean'}]);
 const pid=(await b.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
 for(const operation of ['check','remove','clear']){
  const displayed=await addItemsToList(dbA,owner,[{canonicalItem:'carrot'}]);
  const item=displayed.items.find(x=>x.canonicalItem==='carrot');
  let ready,paused=false;
  const snapshot=new Promise(resolve=>ready=resolve),gate=new Promise(resolve=>release=resolve);
  // Delay only after the actual existing-row SELECT returns. Recursively wrap
  // transaction objects so no SQL, rows, ownership or DB locks are simulated.
  const wrap=target=>new Proxy(target,{get(object,key){
   if(key==='transaction')return callback=>object.transaction(tx=>callback(wrap(tx)));
   if(key==='query')return new Proxy(object.query,{get(queries,table){
    if(table!=='shoppingListItems')return queries[table];
    return new Proxy(queries[table],{get(query,method){
     if(method!=='findMany')return query[method];
     return async(...args)=>{const rows=await query.findMany(...args);if(!paused){paused=true;ready();await gate;}return rows;};
    }});
   }});
   const value=Reflect.get(object,key);return typeof value==='function'?value.bind(object):value;
  }});
  rebuilding=addRecipesToList(wrap(dbA),owner,[recipe],{usePantry:false});
  assert.equal(await Promise.race([snapshot.then(()=>true),rebuilding.then(()=>false)]),true);
  let settled=false;
  const action=operation==='check'?()=>setItemChecked(dbB,owner,item.id,true):operation==='remove'?()=>removeListItem(dbB,owner,item.id):()=>clearShoppingList(dbB,owner,displayed.id);
  mutating=action().then(()=>({ok:true}),error=>({ok:false,error})).finally(()=>settled=true);
  let blocked=false;
  for(let i=0;i<40;i++){
   const activity=(await observer.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0];
   if(activity?.wait_event_type==='Lock'){blocked=true;break;}
   if(settled)break;
   await new Promise(resolve=>setTimeout(resolve,25));
  }
  const settledBeforeRelease=settled;
  release();await rebuilding;const result=await mutating;assert.equal(result.ok,true);
  const current=await getShoppingList(dbA,owner,displayed.id);
  if(operation==='check')assert.equal(current.items.find(x=>x.id===item.id)?.checked,true);
  if(operation==='remove')assert.equal(current.items.some(x=>x.id===item.id),false);
  if(operation==='clear')assert.deepEqual(current.items,[]);
  assert.equal(blocked,true,operation+' must wait until the addition completes its snapshot/rebuild');
  assert.equal(settledBeforeRelease,false);
  await setItemChecked(dbB,other,item.id,false);
  await removeListItem(dbB,other,item.id);
  await clearShoppingList(dbB,other,displayed.id);
  assert.deepEqual(await getShoppingList(dbA,owner,displayed.id),current);
  assert.deepEqual((await getShoppingList(dbB,other,otherList.id)).items.map(x=>x.canonicalItem),['bean']);
  assert.equal(await getShoppingList(dbB,other,displayed.id),null);
  console.log('PASS: independent PostgreSQL shopping '+operation+' preserves reviewed intent after rebuild');
 }
}finally{
 release?.();await rebuilding?.catch(()=>{});await mutating?.catch(()=>{});
 try{await observer.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[[owner,other]]);}finally{await Promise.allSettled(clients.map(c=>c.end()));}
}
