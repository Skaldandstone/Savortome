// Actual draft route, withUser/error mapping, bounded reader and media signatures.
// Clerk, DB and extraction are synthetic. No credentials, network or provider calls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const root = process.cwd().replaceAll('\\', '/');
const classes = names => names.map(name => `export class ${name} extends Error {}`).join('\n');
const mocks = {
  'server-only': '',
  'next/server': 'export const NextResponse={json:(body,options)=>new Response(JSON.stringify(body),options)};',
  '@seconds/core': classes(['InstacartError','KrogerError','PantryIntakeValidationError','PantryValidationError','ReceiptExtractionError','RecipeValidationError','ShelfValidationError','BarcodeValidationError','BarcodeLookupError','FoodLogValidationError','FoodNoteExtractionError','FriendshipError']) + `
    export {isPhotoMediaType} from '${root}/packages/core/src/recipe.ts';
    export const extractReceiptPhoto=async(...args)=>{state.calls.push('receipt');state.args=args;return state.extract();};
    export const MAX_PHOTO_BASE64_CHARS=12000000,MAX_PHOTO_BYTES=9000000;export const parsePantryIntake=value=>value;`,
  '@seconds/db': classes(['PantryIntakeNotFoundError','SaveRecipeError','SaveTemplateError','SuggestionError']) + `export const db=()=>{state.calls.push('db');return {};};export const createPantryIntake=async(_db,user,value)=>{state.saved={user,...value};return state.saved;};export const listPendingPantryIntakes=async()=>[];`,
  '@/lib/session': classes(['NotConfiguredError','NotSignedInError']) + 'export const databaseConfigured=()=>state.database; export const requireUserId=async()=>{state.calls.push("auth");if(!state.signedIn)throw new NotSignedInError("Sign in to do that.");if(state.authError)throw Error("private session diagnostic");return "fixture-owner";};',
  '@/lib/generation-audit': 'export const recordGenerationAudit=()=>{state.calls.push("audit");};',
};
const bundle = await build({bundle:true,write:false,platform:'node',format:'iife',globalName:'capture',stdin:{resolveDir:process.cwd(),contents:"export {GET,POST} from './apps/web/app/api/pantry/intake/scan/route.ts';"},plugins:[{name:'capture-boundaries',setup(api){
  api.onResolve({filter:/.*/},args=>{
    if(args.path==='./session' || args.path==='./session.js')return{path:'@/lib/session',namespace:'mock'};
    if(Object.hasOwn(mocks,args.path))return{path:args.path,namespace:'mock'};
    if(args.path.startsWith('@/lib/'))return{path:root+'/apps/web/'+args.path.slice(2)+'.ts'};
  });
  api.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js',resolveDir:process.cwd()}));
}}]});
function fixture() {
  const state={database:true,signedIn:true,calls:[],logs:[],extract:async()=>({sourceLabel:'Synthetic market',items:[{displayName:'Synthetic beans',quantity:1,unit:null}]})};
  const controller=new AbortController();
  const deadlines=[];
  const env={RECEIPT_SCAN_ENABLED:'true',OPENAI_API_KEY:'synthetic-not-a-key'};
  const signals={any:AbortSignal.any,timeout:ms=>{const deadline=new AbortController();deadlines.push({ms,controller:deadline});return deadline.signal;}};
  const context={state,require,process:{env},Response,Buffer,AbortSignal:signals,AbortController,TextDecoder,Uint8Array,DataView,setTimeout,clearTimeout,console:{error:(...args)=>state.logs.push(args.join(' '))}};
  runInNewContext(bundle.outputFiles[0].text,context);
  const request=(body,headers={})=>{
    const bytes=Buffer.from(typeof body==='string'?body:JSON.stringify(body));let done=false;
    return {json:async()=>{state.onRead?.();return typeof body==='string'?JSON.parse(body):body;},signal:controller.signal,headers:new Headers(headers),body:{getReader(){state.calls.push('body');return{read:async()=>{state.onRead?.();return done?{done:true}:(done=true,{done:false,value:bytes});},cancel:async()=>{state.calls.push('cancel');}}}}};
  };
  return{state,env,api:context.capture,request,controller,deadlines};
}
const body=(base64=Buffer.from('synthetic-image').toString('base64'))=>({imageBase64:base64,imageMediaType:'image/jpeg'});
async function check(response,status){assert.equal(response.status,status);return response.json();}
const noExtraction=f=>assert.equal(f.state.calls.includes('receipt'),false);
const deferred=()=>{let resolve;const promise=new Promise(a=>resolve=a);return{promise,resolve};};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('receipt API: large within-limit base64 does not overflow regex stack',async()=>{
 const f=fixture();await check(await f.api.POST(f.request(body(Buffer.alloc(8000000).toString('base64')))),200);assert.ok(f.state.saved);assert.equal(f.state.args[0].length,10666668);
});
test('receipt API: encoded over-limit and malformed padding refuse provider and persistence',async()=>{
 for(const value of ['A'.repeat(12000004),'=AAA','AA=A','AAA','A===','AA==AA==','AA?=']){const f=fixture();await check(await f.api.POST(f.request(body(value))),400);noExtraction(f);assert.equal(f.state.saved,undefined);}
});
test('receipt API: interrupted request refuses before reading upload',async()=>{
 const f=fixture();f.controller.abort();await check(await f.api.POST(f.request(body())),400);noExtraction(f);assert.equal(f.state.calls.includes('body'),false);
});
test('receipt API: abort during upload refuses before provider',async()=>{
 const f=fixture();f.state.onRead=()=>f.controller.abort();await check(await f.api.POST(f.request(body())),400);noExtraction(f);assert.equal(f.state.saved,undefined);
});
test('receipt API: late extraction after abort or deadline never creates review',async()=>{
 for(const boundary of ['abort','deadline']){const f=fixture(),reply=deferred();f.state.extract=()=>reply.promise;const operation=f.api.POST(f.request(body()));await flush();if(boundary==='abort')f.controller.abort();else{assert.equal(f.deadlines.length,1);f.deadlines[0].controller.abort();}reply.resolve({sourceLabel:'Synthetic market',items:[]});await check(await operation,400);assert.equal(f.state.args[2].signal.aborted,true);assert.equal(f.state.saved,undefined);}
});
test('receipt API: body Content-Length is bounded before reading upload',async()=>{
 const f=fixture();await check(await f.api.POST(f.request(body(),{'content-length':'99999999'})),400);noExtraction(f);assert.equal(f.state.calls.includes('body'),false);
});
test('receipt API: private no-store applies to success and failure; unexpected diagnostics withheld',async()=>{
 for(const mode of ['success','failed']){const f=fixture();if(mode==='failed')f.state.extract=async()=>{throw Error('synthetic private receipt diagnostic');};const response=await f.api.POST(f.request(body()));assert.equal(response.status,mode==='success'?200:500);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.doesNotMatch(await response.text(),/synthetic private receipt diagnostic/);assert.doesNotMatch(f.state.logs.join(' '),/synthetic private receipt diagnostic/);}
});

test('receipt API: signed out or missing DB refuses before body/provider and remains private',async()=>{
 for(const mode of ['signedOut','database']){const f=fixture();if(mode==='signedOut')f.state.signedIn=false;else f.state.database=false;const request={get signal(){throw Error('must not read upload');}};const response=await f.api.POST(request);assert.equal(response.status,mode==='signedOut'?401:501);assert.equal(response.headers.get('cache-control'),'private, no-store');noExtraction(f);assert.equal(f.state.saved,undefined);}
});
test('receipt API: status exposes booleans only and default-off refuses body access',async()=>{
 const f=fixture();assert.deepEqual(await check(await f.api.GET(),200),{enabled:true});f.env.RECEIPT_SCAN_ENABLED='false';const response=await f.api.POST({get signal(){throw Error('must not read upload');}});assert.equal(response.status,501);assert.equal(response.headers.get('cache-control'),'private, no-store');noExtraction(f);
});
test('receipt API: malformed JSON/container cannot trigger extraction',async()=>{
 for(const value of ['{',[],null]){const f=fixture();await check(await f.api.POST(f.request(value)),400);noExtraction(f);assert.equal(f.state.saved,undefined);}
});
