// Actual route and staff-token guard; DB/cleanup/errors are synthetic boundaries.
// No real staff token, data, provider call or hosted request.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
const require=createRequire(import.meta.url);
const mocks={
 'server-only':'',
 'next/server':`export const NextResponse={json:(body,options)=>new Response(JSON.stringify(body),{status:options?.status??200,headers:options?.headers})};`,
 '@seconds/db':`export const db=()=>{state.databaseCalls++;return state.database();};`,
 './session':`export const databaseConfigured=()=>state.databaseConfigured;`,
 './api':`export const errorResponse=(error,privacy)=>{state.privacy=privacy;return new Response(JSON.stringify({error:'Something went wrong on our end.'}),{status:500});};`,
 '@/lib/photo-cleanup':`export const processPendingRecipePhotos=async(database,options)=>{state.cleanupCalls++;state.options=options;return state.cleanup(database);};`,
};
const bundle=await build({bundle:true,write:false,platform:'node',format:'iife',globalName:'operator',stdin:{resolveDir:process.cwd(),contents:`export {POST} from './apps/web/app/api/admin/photo-cleanup/route.ts';export {withAdmin} from './apps/web/lib/admin.ts';`},plugins:[{name:'operator-boundaries',setup(api){api.onResolve({filter:/.*/},args=>args.path==='@/lib/admin'?{path:process.cwd()+'/apps/web/lib/admin.ts'}:Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'mock'}:undefined);api.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js'}));}}]});
function fixture(){
 const env={ADMIN_API_TOKEN:'synthetic-admin',PHOTO_CLEANUP_ENABLED:'true',DATABASE_URL:'postgresql://synthetic@localhost/synthetic',R2_ACCOUNT_ID:'synthetic-account',R2_BUCKET_NAME:'synthetic-bucket',PHOTO_CLEANUP_EXPECTED_R2_ACCOUNT_ID:'synthetic-account',PHOTO_CLEANUP_EXPECTED_R2_BUCKET:'synthetic-bucket'};
 env.PHOTO_CLEANUP_EXPECTED_DATABASE_SHA256=createHash('sha256').update(env.DATABASE_URL).digest('hex');
 const state={databaseConfigured:true,databaseCalls:0,cleanupCalls:0};state.database=()=>({});state.cleanup=async()=>({completed:1,failed:1,blocked:0});
 const context={state,process:{env},require,Buffer,Response};runInNewContext(bundle.outputFiles[0].text,context);
 const request=(body='{}',headers={})=>new Request('https://fixture.invalid/api/admin/photo-cleanup',{method:'POST',headers:{'x-admin-token':'synthetic-admin',...headers},body});
 return{env,state,api:context.operator,request};
}
const noDispatch=f=>{assert.equal(f.state.databaseCalls,0);assert.equal(f.state.cleanupCalls,0);};
test('photo operator: missing, wrong-length and wrong-value staff tokens refuse before body/data',async()=>{
 for(const token of [null,'wrong','synthetic-admix']){const f=fixture();const request={headers:new Headers(token?{'x-admin-token':token}:{}),get body(){throw Error('body must not be read');}};const response=await f.api.POST(request);assert.equal(response.status,401);assert.equal(response.headers.get('cache-control'),'no-store');noDispatch(f);}
});
test('photo operator: default-off and malformed enable flags refuse before body/data',async()=>{
 for(const flag of [undefined,'false','TRUE','1']){const f=fixture();if(flag===undefined)delete f.env.PHOTO_CLEANUP_ENABLED;else f.env.PHOTO_CLEANUP_ENABLED=flag;const response=await f.api.POST({headers:new Headers({'x-admin-token':'synthetic-admin'}),get body(){throw Error('body must not be read');}});assert.equal(response.status,501);noDispatch(f);}
});
test('photo operator: absent/mismatched database or storage pins refuse dispatch',async()=>{
 for(const name of ['PHOTO_CLEANUP_EXPECTED_DATABASE_SHA256','PHOTO_CLEANUP_EXPECTED_R2_ACCOUNT_ID','PHOTO_CLEANUP_EXPECTED_R2_BUCKET','DATABASE_URL','R2_ACCOUNT_ID','R2_BUCKET_NAME']){
  for(const value of [undefined,'different']){const f=fixture();if(value===undefined)delete f.env[name];else f.env[name]=value;assert.equal((await f.api.POST(f.request())).status,501);noDispatch(f);}
 }
});
test('photo operator: malformed body, unknown selectors and invalid limits cannot dispatch',async()=>{
 for(const body of ['','{','null','[]','{"key":"private-key"}','{"ownerId":"other"}','{"limit":0}','{"limit":11}','{"limit":"1"}','{"timeoutMs":99}','{"timeoutMs":3001}','{"timeoutMs":1.5}']){
  const f=fixture();assert.equal((await f.api.POST(f.request(body))).status,400);noDispatch(f);
 }
});
test('photo operator: body cap applies without or with dishonest content length',async()=>{
 for(const headers of [{},{'content-length':'1'},{'content-length':'513'},{'content-length':'invalid'}]){const f=fixture();assert.equal((await f.api.POST(f.request(' '.repeat(600),headers))).status,400);noDispatch(f);}
});
test('photo operator: one authorized batch returns counts only and cannot be cached',async()=>{
 const f=fixture();const response=await f.api.POST(f.request('{"limit":1,"timeoutMs":100}'));assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual(await response.json(),{completed:1,failed:1,blocked:0});assert.deepEqual(JSON.parse(JSON.stringify(f.state.options)),{limit:1,timeoutMs:100});assert.equal(f.state.cleanupCalls,1);assert.equal(f.state.databaseCalls,1);
});
test('photo operator: DB factory failure is generic and requests redacted diagnostics',async()=>{
 const f=fixture();f.state.database=()=>{throw new Error('synthetic private database diagnostic');};const response=await f.api.POST(f.request());assert.equal(response.status,500);assert.deepEqual(await response.json(),{error:'Something went wrong on our end.'});assert.equal(f.state.privacy.redactUnexpectedErrors,true);assert.equal(f.state.cleanupCalls,0);
});
test('photo operator: cleanup rejection is generic with no private provider details',async()=>{
 const f=fixture();f.state.cleanup=async()=>{throw new Error('synthetic private photo key');};const response=await f.api.POST(f.request());assert.equal(response.status,500);assert.deepEqual(await response.json(),{error:'Something went wrong on our end.'});assert.equal(f.state.privacy.redactUnexpectedErrors,true);assert.equal(response.headers.get('cache-control'),'no-store');
});
test('photo operator: missing DB configuration does not initialize DB or cleanup',async()=>{
 const f=fixture();f.state.databaseConfigured=false;assert.equal((await f.api.POST(f.request())).status,501);noDispatch(f);
});
test('staff guard: existing caller remains compatible without cleanup flag or optional privacy',async()=>{
 const f=fixture();delete f.env.PHOTO_CLEANUP_ENABLED;const response=await f.api.withAdmin(f.request(),async()=>({legacy:true}));assert.equal(response.status,200);assert.deepEqual(await response.json(),{legacy:true});assert.equal(f.state.cleanupCalls,0);
});
