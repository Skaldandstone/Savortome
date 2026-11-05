// Actual draft route, withUser/error mapping, bounded reader and media signatures.
// Clerk, DB and extraction are synthetic. No credentials, network or provider calls.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
const root = process.cwd().replaceAll('\\', '/');
const classes = names => names.map(name => `export class ${name} extends Error {}`).join('\n');
const mocks = {
  'server-only': '',
  'next/server': 'export const NextResponse={json:(body,options)=>new Response(JSON.stringify(body),options)};',
  '@seconds/core': classes(['InstacartError','KrogerError','PantryIntakeValidationError','PantryValidationError','ReceiptExtractionError','RecipeValidationError','ShelfValidationError','BarcodeValidationError','BarcodeLookupError','FoodLogValidationError','FoodNoteExtractionError','FriendshipError']) + `
    export {isPhotoMediaType} from '${root}/packages/core/src/recipe.ts';
    export const extractFoodPhoto=async(...args)=>{state.calls.push('photo');state.args=args;return state.extract();};
    export const extractFoodVoice=async(...args)=>{state.calls.push('voice');state.args=args;return state.extract();};`,
  '@seconds/db': classes(['PantryIntakeNotFoundError','SaveRecipeError','SaveTemplateError','SuggestionError']) + 'export const db=()=>{state.calls.push("db");return {};};',
  '@/lib/session': classes(['NotConfiguredError','NotSignedInError']) + 'export const databaseConfigured=()=>state.database; export const requireUserId=async()=>{state.calls.push("auth");if(!state.signedIn)throw new NotSignedInError("Sign in to do that.");if(state.authError)throw Error("private session diagnostic");return "fixture-owner";};',
  '@/lib/generation-audit': 'export const recordGenerationAudit=()=>{state.calls.push("audit");};',
};
const bundle = await build({bundle:true,write:false,platform:'node',format:'iife',globalName:'capture',stdin:{resolveDir:process.cwd(),contents:"export {GET,POST} from './apps/web/app/api/food-log/draft/route.ts';"},plugins:[{name:'capture-boundaries',setup(api){
  api.onResolve({filter:/.*/},args=>{
    if(args.path==='./session' || args.path==='./session.js')return{path:'@/lib/session',namespace:'mock'};
    if(Object.hasOwn(mocks,args.path))return{path:args.path,namespace:'mock'};
    if(args.path.startsWith('@/lib/'))return{path:root+'/apps/web/'+args.path.slice(2)+'.ts'};
  });
  api.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js',resolveDir:process.cwd()}));
}}]});
function fixture() {
  const state={database:true,signedIn:true,calls:[],logs:[],extract:async()=>({description:'Review this suggestion',items:[]})};
  const controller=new AbortController();
  const deadlines=[];
  const env={FOOD_PHOTO_ENABLED:'true',FOOD_VOICE_ENABLED:'true',OPENAI_API_KEY:'synthetic-not-a-key'};
  const signals={any:AbortSignal.any,timeout:ms=>{const deadline=new AbortController();deadlines.push({ms,controller:deadline});return deadline.signal;}};
  const context={state,process:{env},Response,Buffer,AbortSignal:signals,TextDecoder,Uint8Array,DataView,setTimeout,clearTimeout,console:{error:(...args)=>state.logs.push(args.join(' '))}};
  runInNewContext(bundle.outputFiles[0].text,context);
  const request=(body,headers={})=>{
    const bytes=Buffer.from(typeof body==='string'?body:JSON.stringify(body));let done=false;
    return {signal:controller.signal,headers:new Headers(headers),body:{getReader(){state.calls.push('body');return{read:async()=>{state.onRead?.();return done?{done:true}:(done=true,{done:false,value:bytes});},cancel:async()=>{state.calls.push('cancel');}}}}};
  };
  return{state,env,api:context.capture,request,controller,deadlines};
}
function media(type,size=32) {
  const bytes=Buffer.alloc(size);
  if(type==='image/jpeg')bytes.set([0xff,0xd8,0xff]);
  if(type==='image/png'){bytes.set([137,80,78,71,13,10,26,10]);bytes.write('IHDR',12);}
  if(type==='image/webp'){bytes.write('RIFF',0);bytes.write('WEBP',8);bytes.write('VP8 ',12);}
  if(type==='audio/wav'){bytes.write('RIFF',0);bytes.write('WAVE',8);}
  if(type==='audio/mpeg')bytes.write('ID3',0);
  if(type==='audio/mp4'){bytes.writeUInt32BE(16,0);bytes.write('ftyp',4);bytes.write('M4A ',8);}
  if(type==='audio/webm'){bytes.set([0x1a,0x45,0xdf,0xa3,0x42,0x82,0x84]);bytes.write('webm',7);}
  return bytes;
}
const body=(source='photo',mediaType='image/jpeg',bytes=media(mediaType))=>({source,mediaType,base64:bytes.toString('base64')});
async function check(response,status){assert.equal(response.status,status);assert.equal(response.headers.get('cache-control'),'private, no-store');return response.json();}
const noExtraction=f=>assert.equal(f.state.calls.some(x=>x==='photo'||x==='voice'||x==='audit'),false);
const unreadable={get headers(){throw Error('body must remain untouched');}};

test('capture API: auth and missing DB refuse before upload access',async()=>{
  for(const mode of ['signedOut','database']){const f=fixture();if(mode==='signedOut')f.state.signedIn=false;else f.state.database=false;await check(await f.api.POST(unreadable),mode==='signedOut'?401:501);noExtraction(f);assert.equal(f.state.calls.includes('body'),false);}
});
test('capture API: status requires auth and exposes booleans only',async()=>{
  const f=fixture();assert.deepEqual(await check(await f.api.GET(),200),{photo:true,voice:true});f.state.signedIn=false;await check(await f.api.GET(),401);noExtraction(f);
});
test('capture API: default-off, nonexact flags and empty key refuse before upload access',async()=>{
  for(const mode of ['off','nonexact','missingKey','blankKey']){const f=fixture();if(mode==='off'){delete f.env.FOOD_PHOTO_ENABLED;delete f.env.FOOD_VOICE_ENABLED;}if(mode==='nonexact'){f.env.FOOD_PHOTO_ENABLED='TRUE';f.env.FOOD_VOICE_ENABLED='1';}if(mode==='missingKey')delete f.env.OPENAI_API_KEY;if(mode==='blankKey')f.env.OPENAI_API_KEY=' ';await check(await f.api.POST(unreadable),501);noExtraction(f);}
});
test('capture API: disabled individual source cannot use enabled sibling',async()=>{
  for(const source of ['photo','voice']){const f=fixture();f.env[source==='photo'?'FOOD_PHOTO_ENABLED':'FOOD_VOICE_ENABLED']='false';await check(await f.api.POST(f.request(body(source,source==='photo'?'image/jpeg':'audio/wav'))),501);noExtraction(f);}
});
test('capture API: malformed JSON, array, null and source refuse extraction',async()=>{
  for(const input of ['{',[],null,{}, {...body(),source:'receipt'}]){const f=fixture();await check(await f.api.POST(f.request(input)),400);noExtraction(f);assert.ok(f.state.calls.includes('cancel'));}
});
test('capture API: advertised and actual streamed upload bounds refuse extraction',async()=>{
  for(const advertised of [true,false]){const f=fixture();await check(await f.api.POST(f.request(advertised?body():' '.repeat(12_000_001),advertised?{'content-length':'12000001'}:{})),400);noExtraction(f);assert.equal(f.state.calls.includes('body'),!advertised);}
});
test('capture API: reader diagnostics are redacted and cancellation is requested',async()=>{
  const f=fixture();const request={signal:f.controller.signal,headers:new Headers(),body:{getReader:()=>({read:async()=>{throw Error('private transport diagnostic');},cancel:async()=>f.state.calls.push('cancel')})}};
  const result=await check(await f.api.POST(request),400);assert.equal(JSON.stringify(result).includes('private transport'),false);assert.ok(f.state.calls.includes('cancel'));noExtraction(f);
});
test('capture API: malformed base64 never reaches extraction',async()=>{
  for(const base64 of ['',null,42,'a','@@@@','data:image/jpeg;base64,AAAA','AAAA\n','====','A===','AA=A','=AAA','AAAA=AAA']){const f=fixture();await check(await f.api.POST(f.request({...body(),base64})),400);noExtraction(f);}
});
test('capture API: decoded voice and photo bounds are independent of JSON bound',async()=>{
  for(const [source,type,size] of [['photo','image/jpeg',8_000_001],['voice','audio/wav',5_000_001]]){const f=fixture();await check(await f.api.POST(f.request(body(source,type,media(type,size)))),400);noExtraction(f);}
});
test('capture API: large in-bound base64 does not exhaust validator stack',async()=>{
  const f=fixture();await check(await f.api.POST(f.request(body('photo','image/jpeg',media('image/jpeg',8_000_000)))),200);assert.ok(f.state.calls.includes('photo'));
});
test('capture API: padding variants and maximum voice size preserve exact synthetic bytes',async()=>{
  for(const size of [31,32,33,5_000_000]){const f=fixture(),bytes=media('audio/wav',size);await check(await f.api.POST(f.request(body('voice','audio/wav',bytes))),200);assert.deepEqual(f.state.args[0],bytes);assert.deepEqual(f.state.calls.filter(x=>x==='photo'||x==='voice'),['voice']);}
});
test('capture API: unsupported, truncated and mismatched media cannot reach extraction',async()=>{
  for(const input of [body('photo','image/gif'),body('voice','audio/ogg'),body('photo','image/png',media('image/jpeg')),body('voice','audio/wav',media('image/png')),body('photo','image/jpeg',Buffer.from([255,216,255])),body('voice','audio/webm',Buffer.alloc(32))]){const f=fixture();await check(await f.api.POST(f.request(input)),400);noExtraction(f);}
});
test('capture API: approved headers dispatch only matching synthetic extractor and return a draft',async()=>{
  for(const type of ['image/jpeg','image/png','image/webp','audio/wav','audio/mpeg','audio/mp4','audio/webm']){const f=fixture();const source=type.startsWith('image/')?'photo':'voice',input=body(source,type);assert.deepEqual(await check(await f.api.POST(f.request(input)),200),{draft:{description:'Review this suggestion',items:[]}});assert.deepEqual(f.state.calls.filter(x=>x==='photo'||x==='voice'),[source]);assert.equal(f.state.args[1],type);assert.equal(f.state.args[2].signal.aborted,false);assert.equal(typeof f.state.args[2].onGenerationAudit,'function');assert.equal(f.state.calls.includes('audit'),false);}
});
test('capture API: unexpected auth and extraction diagnostics stay out of response and logs',async()=>{
  for(const auth of [true,false]){const f=fixture();f.state.authError=auth;f.state.extract=async()=>{throw Error('private food transcript and provider diagnostic');};assert.deepEqual(await check(await f.api.POST(f.request(body())),500),{error:'Something went wrong on our end.'});assert.deepEqual(f.state.logs,['Unhandled food-support API error; details withheld.']);if(auth)noExtraction(f);}
});
test('capture API: already-aborted request refuses before upload access',async()=>{
  const f=fixture();f.controller.abort();await check(await f.api.POST({signal:f.controller.signal,get headers(){throw Error('must not read');}}),400);noExtraction(f);assert.equal(f.state.calls.includes('body'),false);
});
test('capture API: abort during body reading prevents extraction for both capture sources',async()=>{
  for(const source of ['photo','voice']){const f=fixture();f.state.onRead=()=>f.controller.abort();await check(await f.api.POST(f.request(body(source,source==='photo'?'image/jpeg':'audio/wav'))),400);noExtraction(f);}
});
test('capture API: in-flight abort reaches extractor and late draft is withheld',async()=>{
  for(const source of ['photo','voice']){const f=fixture();let finish;f.state.extract=()=>new Promise(resolve=>{finish=resolve;});const operation=f.api.POST(f.request(body(source,source==='photo'?'image/jpeg':'audio/wav')));for(let i=0;i<20&&!finish;i++)await Promise.resolve();assert.ok(finish);f.controller.abort();assert.equal(f.state.args[2].signal.aborted,true);finish({description:'late private draft',items:[]});const response=await check(await operation,400);assert.equal(JSON.stringify(response).includes('late private'),false);assert.equal(Object.hasOwn(response,'draft'),false);}
});
test('capture API: source-specific deadline still aborts and withholds late draft',async()=>{
  for(const source of ['photo','voice']){const f=fixture();let finish;f.state.extract=()=>new Promise(resolve=>{finish=resolve;});const operation=f.api.POST(f.request(body(source,source==='photo'?'image/jpeg':'audio/wav')));for(let i=0;i<20&&!finish;i++)await Promise.resolve();assert.ok(finish);assert.equal(f.deadlines.length,1);assert.equal(f.deadlines[0].ms,source==='photo'?40_000:70_000);f.deadlines[0].controller.abort();assert.equal(f.state.args[2].signal.aborted,true);assert.equal(f.controller.signal.aborted,false);finish({description:'late private draft',items:[]});const response=await check(await operation,400);assert.equal(Object.hasOwn(response,'draft'),false);}
});
