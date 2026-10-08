// Actual mobile account client/token helper and core transport, synthetic Clerk/fetch/clock.
// No real credentials, network, provider or device/session acceptance.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';
const mocks={
 '@seconds/core/format':`export {createClient} from './packages/core/src/api-client.ts';`,
 '@clerk/expo':`export const getClerkInstance=()=>({get session(){return state.session;}});`,
 './api':`export const apiBaseUrl=()=> 'https://fixture.invalid';`,
};
const bundle=await build({bundle:true,write:false,format:'iife',globalName:'app',stdin:{resolveDir:process.cwd(),contents:`export {createAccountClient} from './apps/mobile/lib/client.ts';export {createClient} from './packages/core/src/api-client.ts';`},plugins:[{name:'account-network-boundaries',setup(api){api.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'mock'}:undefined);api.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js',resolveDir:process.cwd()}));}}]});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const input={id:'00000000-0000-4000-8000-000000000001',date:'2026-10-04',title:'Synthetic soup',portion:null,source:'text',expectedUpdatedAt:'2026-10-04T12:00:00.000Z'};
function fixture(){
 const state={session:null,calls:[],timers:new Map(),nextTimer:0,respond:async()=>({ok:true,status:200,json:async()=>({deleted:true})})};
 const context={state,AbortController,setTimeout:(fn,ms)=>{const id=++state.nextTimer;state.timers.set(id,{fn,ms});return id;},clearTimeout:id=>state.timers.delete(id),fetch:async(url,options)=>{state.calls.push({url,options});return state.respond(url,options);}};
 runInNewContext(bundle.outputFiles[0].text,context);
 const session=(account='account-a',id='session-a',token=async()=> 'synthetic-token-a')=>({id,user:{id:account},getToken:token});
 const expire=()=>{const [id,timer]=[...state.timers][0];assert.equal(timer.ms,12000);state.timers.delete(id);timer.fn();};
 return {state,app:context.app,session,expire};
}
test('signed-out and wrong-account clients never dispatch food-note requests',async()=>{const f=fixture();const api=f.app.createAccountClient('account-a');await assert.rejects(api.saveFoodNote(input),/Sign in/);f.state.session=f.session('account-b');await assert.rejects(api.deleteFoodNote(input.id),/Sign in/);assert.equal(f.state.calls.length,0);assert.equal(f.state.timers.size,0);});
test('account switch during token refresh never sends the old request with a new token',async()=>{const f=fixture();const token=deferred();f.state.session=f.session('account-a','session-a',()=>token.promise);const request=f.app.createAccountClient('account-a').saveFoodNote(input);const outcome=assert.rejects(request,/Sign in/);await flush();f.state.session=f.session('account-b','session-b',async()=> 'synthetic-token-b');token.resolve('synthetic-token-a');await outcome;assert.equal(f.state.calls.length,0);assert.equal(f.state.timers.size,0);});
test('same-account session replacement and sign-out invalidate pending token acquisition',async()=>{for(const signedOut of [false,true]){const f=fixture();const token=deferred();f.state.session=f.session('account-a','session-a',()=>token.promise);const outcome=assert.rejects(f.app.createAccountClient('account-a').deleteFoodNote(input.id),/Sign in/);await flush();f.state.session=signedOut?null:f.session('account-a','session-new');token.resolve('synthetic-token-a');await outcome;assert.equal(f.state.calls.length,0);}});
test('initiating account token and exact reviewed edit payload are sent once',async()=>{const f=fixture();f.state.session=f.session();await f.app.createAccountClient('account-a').saveFoodNote(input);assert.equal(f.state.calls.length,1);const {url,options}=f.state.calls[0];assert.equal(url,'https://fixture.invalid/api/food-log');assert.equal(options.method,'POST');assert.equal(options.headers.authorization,'Bearer synthetic-token-a');assert.deepEqual(JSON.parse(options.body),input);assert.equal(f.state.timers.size,0);});
test('web expected-session boundary is carried unchanged, without a native bearer token',async()=>{const f=fixture();await f.app.createClient({expectedSessionId:'synthetic-session'}).deleteFoodNote(input.id);const {options}=f.state.calls[0];assert.equal(options.headers['x-savortome-expected-session'],'synthetic-session');assert.equal(options.headers.authorization,undefined);assert.deepEqual(JSON.parse(options.body),{id:input.id});});
test('expired token acquisition cannot dispatch a request after its timeout',async()=>{const f=fixture();const token=deferred();f.state.session=f.session('account-a','session-a',()=>token.promise);const outcome=assert.rejects(f.app.createAccountClient('account-a').saveFoodNote(input),error=>error.status===408);await flush();f.expire();await outcome;token.resolve('synthetic-token-a');await flush();assert.equal(f.state.calls.length,0);assert.equal(f.state.timers.size,0);});
test('stalled dispatched delete times out, aborts, and never automatically retries',async()=>{const f=fixture();f.state.session=f.session();const reply=deferred();f.state.respond=()=>reply.promise;const outcome=assert.rejects(f.app.createAccountClient('account-a').deleteFoodNote(input.id),error=>error.status===408);await flush();assert.equal(f.state.calls.length,1);f.expire();await outcome;assert.equal(f.state.calls[0].options.signal.aborted,true);reply.resolve({ok:true,status:200,json:async()=>({deleted:true})});await flush();assert.equal(f.state.calls.length,1);assert.equal(f.state.timers.size,0);});
test('HTTP expiry and malformed success remain transport evidence, not saved-note claims',async()=>{const f=fixture();f.state.session=f.session();f.state.respond=async()=>({ok:false,status:401,json:async()=>({error:'Synthetic expired session'})});await assert.rejects(f.app.createAccountClient('account-a').saveFoodNote(input),error=>error.status===401);f.state.respond=async()=>({ok:true,status:200,json:async()=>{throw Error('bad JSON');}});assert.equal(await f.app.createAccountClient('account-a').saveFoodNote(input),null);assert.equal(f.state.calls.length,2);assert.equal(f.state.timers.size,0);});

for(const removal of [false,true])test(`photo transport: ${removal?'removal':'upload'} deadline aborts once and preserves expected session`,async()=>{const f=fixture(),reply=deferred();f.state.respond=()=>reply.promise;const api=f.app.createClient({expectedSessionId:'synthetic-session'});const request=removal?api.removeRecipePhoto(input.id,'synthetic/key'):api.addRecipePhoto(input.id,'aGVsbG8=','image/jpeg');const outcome=assert.rejects(request,error=>error.status===408);await flush();assert.equal(f.state.calls.length,1);assert.equal(f.state.calls[0].options.headers['x-savortome-expected-session'],'synthetic-session');const [id,timer]=[...f.state.timers][0];assert.equal(timer.ms,removal?12000:20000);f.state.timers.delete(id);timer.fn();await outcome;assert.equal(f.state.calls[0].options.signal.aborted,true);reply.resolve({ok:true,status:200,json:async()=>({photos:[]})});await flush();assert.equal(f.state.calls.length,1);assert.equal(f.state.timers.size,0);});

test('food reads and optional media refuse account/session replacement while acquiring token',async()=>{
 const operations=[api=>api.listFoodNotes(),api=>api.foodNoteCaptureStatus(),api=>api.foodNoteDraft('photo','c3ludGhldGlj','image/jpeg'),api=>api.foodNoteDraft('voice','c3ludGhldGlj','audio/wav')];
 for(const operation of operations)for(const replacement of ['account','session','signout']){
  const f=fixture(),token=deferred();f.state.session=f.session('account-a','session-a',()=>token.promise);
  const outcome=assert.rejects(operation(f.app.createAccountClient('account-a')),/Sign in/);await flush();
  f.state.session=replacement==='signout'?null:f.session(replacement==='account'?'account-b':'account-a','session-new');
  token.resolve('synthetic-token-a');await outcome;assert.equal(f.state.calls.length,0);assert.equal(f.state.timers.size,0);
 }
});
test('optional capture deadline prevents late token dispatch and bounds stalled response reading',async()=>{
 for(const phase of ['token','json']){
  const f=fixture(),pending=deferred();f.state.session=f.session('account-a','session-a',phase==='token'?()=>pending.promise:async()=> 'synthetic-token-a');
  if(phase==='json')f.state.respond=async()=>({ok:true,status:200,json:()=>pending.promise});
  const outcome=assert.rejects(f.app.createAccountClient('account-a').foodNoteDraft('voice','c3ludGhldGlj','audio/wav'),error=>error.status===408);
  await flush();const [id,timer]=[...f.state.timers][0];assert.equal(timer.ms,75000);f.state.timers.delete(id);timer.fn();await outcome;
  if(phase==='json')assert.equal(f.state.calls[0].options.signal.aborted,true);
  pending.resolve(phase==='token'?'synthetic-token-a':{draft:{title:'Late synthetic note',portion:null,uncertainty:'Review'}});await flush();
  assert.equal(f.state.calls.length,phase==='token'?0:1);assert.equal(f.state.timers.size,0);
 }
});
test('optional photo and voice send only the explicit capture payload with initiating bearer',async()=>{
 for(const [source,mediaType] of [['photo','image/jpeg'],['voice','audio/wav']]){
  const f=fixture();f.state.session=f.session();await f.app.createAccountClient('account-a').foodNoteDraft(source,'c3ludGhldGlj',mediaType);
  const {url,options}=f.state.calls[0];assert.equal(url,'https://fixture.invalid/api/food-log/draft');assert.equal(options.method,'POST');assert.equal(options.headers.authorization,'Bearer synthetic-token-a');
  assert.deepEqual(JSON.parse(options.body),{source,base64:'c3ludGhldGlj',mediaType});assert.equal(f.state.calls.length,1);assert.equal(f.state.timers.size,0);
 }
});
test('food-note date remains one encoded query value, not an extra owner parameter',async()=>{
 const f=fixture();f.state.session=f.session();const date='2026-10-04&userId=other?date=2026-10-03';await f.app.createAccountClient('account-a').listFoodNotes(date);
 assert.equal(f.state.calls.length,1);const {url,options}=f.state.calls[0];assert.equal(url,'https://fixture.invalid/api/food-log?date='+encodeURIComponent(date));assert.equal(options.headers.authorization,'Bearer synthetic-token-a');assert.equal(options.body,undefined);assert.equal(f.state.timers.size,0);
});
