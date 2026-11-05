// Actual web adapter + r2 helper. Synthetic SDK and processor; no real endpoints.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';
const mocks={
 'server-only':'',
 './session.js':`export class NotConfiguredError extends Error{}`,
 '@seconds/db':`export const processPendingPhotoDeletions=async(database,erase,options)=>{state.batchCalls++;state.database=database;state.options=options;return state.batch(erase);};`,
 '@aws-sdk/client-s3':`export class DeleteObjectCommand{constructor(input){this.input=input;}};export class PutObjectCommand{};export class S3Client{constructor(){state.clients++;}send(command,options){state.storageCalls++;state.command=command.input;state.signal=options?.abortSignal;return state.send();}};`,
};
const bundle=await build({bundle:true,write:false,platform:'node',format:'iife',globalName:'adapter',stdin:{resolveDir:process.cwd(),contents:`export {processPendingRecipePhotos} from './apps/web/lib/photo-cleanup.ts';export {deleteRecipePhoto} from './apps/web/lib/r2.ts';`},plugins:[{name:'cleanup-boundaries',setup(api){api.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'mock'}:undefined);api.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js'}));}}]});
function fixture(){
 const state={clients:0,storageCalls:0,batchCalls:0};
 const env={R2_ACCOUNT_ID:'synthetic',R2_ACCESS_KEY_ID:'synthetic',R2_SECRET_ACCESS_KEY:'synthetic',R2_BUCKET_NAME:'synthetic-bucket',R2_PUBLIC_URL_BASE:'https://fixture.invalid'};
 const context={state,process:{env}};runInNewContext(bundle.outputFiles[0].text,context);
 state.send=async()=>{};state.batch=async erase=>{await erase('synthetic/key',new AbortController().signal);return{completed:1,failed:0,blocked:0};};
 return{state,env,api:context.adapter};
}
test('photo adapter: missing storage configuration refuses before database or SDK dispatch',async()=>{
 for(const missing of ['R2_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET_NAME','R2_PUBLIC_URL_BASE']){
  const f=fixture();delete f.env[missing];await assert.rejects(f.api.processPendingRecipePhotos({}),/storage is unavailable/);
  assert.equal(f.state.batchCalls,0);assert.equal(f.state.clients,0);assert.equal(f.state.storageCalls,0);
 }
});
test('photo adapter: forwards trusted processor options and exact AbortSignal to strict delete',async()=>{
 const f=fixture(),database={},options={limit:1,timeoutMs:100},controller=new AbortController();
 f.state.batch=async erase=>{await erase('synthetic/key',controller.signal);return{completed:1,failed:0,blocked:0};};
 assert.deepEqual(await f.api.processPendingRecipePhotos(database,options),{completed:1,failed:0,blocked:0});
 assert.equal(f.state.database,database);assert.equal(f.state.options,options);assert.equal(f.state.signal,controller.signal);
 assert.deepEqual(JSON.parse(JSON.stringify(f.state.command)),{Bucket:'synthetic-bucket',Key:'synthetic/key'});
});
test('photo adapter: storage rejection reaches processor; never resolved as successful erasure',async()=>{
 const f=fixture(),failure=new Error('synthetic storage failure');f.state.send=async()=>{throw failure;};
 await assert.rejects(f.api.processPendingRecipePhotos({}),error=>error===failure);assert.equal(f.state.storageCalls,1);
});
test('photo adapter: already-aborted operation creates no storage client or request',async()=>{
 const f=fixture(),controller=new AbortController();controller.abort();
 await assert.rejects(f.api.deleteRecipePhoto('synthetic/key',controller.signal),/was aborted/);
 assert.equal(f.state.clients,0);assert.equal(f.state.storageCalls,0);
});
test('photo adapter: in-flight abort reaches synthetic SDK and rejection is preserved',async()=>{
 const f=fixture(),controller=new AbortController();
 f.state.send=()=>new Promise((_,reject)=>f.state.signal.addEventListener('abort',()=>reject(new Error('synthetic abort')),{once:true}));
 const operation=f.api.deleteRecipePhoto('synthetic/key',controller.signal);controller.abort();
 await assert.rejects(operation,/synthetic abort/);assert.equal(f.state.signal,controller.signal);
});
test('photo adapter: existing single-delete caller without signal remains supported',async()=>{
 const f=fixture();await f.api.deleteRecipePhoto('synthetic/key');assert.equal(f.state.storageCalls,1);assert.equal(f.state.signal,undefined);
});
