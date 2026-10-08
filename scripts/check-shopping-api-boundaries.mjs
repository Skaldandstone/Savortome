// Actual list route, bounded reader and API guard; synthetic auth/DB only.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';
const root=process.cwd().replaceAll('\\','/');
const classes=names=>names.map(name=>`export class ${name} extends Error {}`).join('\n');
const mocks={
 'server-only':'',
 'next/server':'export const NextResponse={json:(body,options)=>new Response(JSON.stringify(body),options)};',
 '@seconds/core':classes(['InstacartError','KrogerError','PantryIntakeValidationError','PantryValidationError','ReceiptExtractionError','RecipeValidationError','ShelfValidationError','BarcodeValidationError','BarcodeLookupError','FoodLogValidationError','FoodNoteExtractionError','FriendshipError']),
 '@seconds/core/format':`export {isUuid} from '${root}/packages/core/src/ids.ts';`,
 '@seconds/db':classes(['PantryIntakeNotFoundError','SaveRecipeError','SaveTemplateError','SuggestionError'])+`
 export const db=()=>({});
 export const currentShoppingList=async()=>{state.calls.push('current');return 'synthetic-list';};
 export const getShoppingList=async()=>({id:'synthetic-list',items:[]});
 export const clearShoppingList=async()=>{state.calls.push('clear');};
 export const addRecipesToList=async(_db,owner,ids,options)=>{state.calls.push('recipes');state.saved={owner,ids,options};if(state.fail)throw Error('synthetic private query values');return {id:'synthetic-list',items:[]};};
 export const addItemsToList=async(_db,owner,items)=>{state.calls.push('items');state.saved={owner,items};return {id:'synthetic-list',items:[]};};`,
 '@/lib/session':classes(['NotConfiguredError','NotSignedInError'])+`export const databaseConfigured=()=>state.configured;export const requireUserId=async()=>{if(!state.signedIn)throw new NotSignedInError('Sign in to do that.');return 'synthetic-owner';};`,
};
const bundle=await build({bundle:true,write:false,platform:'node',format:'iife',globalName:'shopping',stdin:{resolveDir:process.cwd(),contents:"export {GET,POST,DELETE} from './apps/web/app/api/list/route.ts';"},plugins:[{name:'shopping-boundaries',setup(api){
 api.onResolve({filter:/.*/},args=>{if(args.path==='./session'||args.path==='./session.js')return{path:'@/lib/session',namespace:'mock'};if(Object.hasOwn(mocks,args.path))return{path:args.path,namespace:'mock'};if(args.path.startsWith('@/lib/'))return{path:root+'/apps/web/'+args.path.slice(2)+'.ts'};});
 api.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js',resolveDir:process.cwd()}));
}}]});
function fixture(){const state={configured:true,signedIn:true,calls:[],logs:[]};const context={state,Response,TextDecoder,Uint8Array,setTimeout,clearTimeout,console:{error:(...args)=>state.logs.push(args.join(' '))}};runInNewContext(bundle.outputFiles[0].text,context);return{state,api:context.shopping,request:body=>new Request('https://fixture.invalid/api/list',{method:'POST',body:JSON.stringify(body)})};}
async function check(response,status){assert.equal(response.status,status);assert.equal(response.headers.get('cache-control'),'private, no-store');return response.json();}
const id='10000000-0000-4000-8000-000000000001';
test('shopping refuses malformed recipe selections before mutation',async()=>{for(const recipeIds of ['not-an-array',[null],['not-a-uuid'],Array(101).fill(id)]){const f=fixture();await check(await f.api.POST(f.request({recipeIds})),400);assert.equal(f.state.calls.length,0);}});
test('shopping refuses non-boolean options before mutation',async()=>{for(const key of ['skipStaples','skipOptional','usePantry'])for(const value of ['false',0,null]){const f=fixture();await check(await f.api.POST(f.request({recipeIds:[id],[key]:value})),400);assert.equal(f.state.calls.length,0);}});
test('signed out or unavailable DB refuses request access for every method',async()=>{for(const mode of ['signedIn','configured'])for(const method of ['GET','POST','DELETE']){const f=fixture();f.state[mode]=false;await check(await f.api[method]({get headers(){throw Error('must not read body');}}),mode==='signedIn'?401:501);assert.equal(f.state.calls.length,0);}});
test('valid recipe and loose requests retain authenticated ownership and explicit options',async()=>{const f=fixture();await check(await f.api.POST(f.request({recipeIds:[id],usePantry:false,userId:'other-owner'})),200);assert.equal(f.state.saved.owner,'synthetic-owner');assert.deepEqual(Array.from(f.state.saved.ids),[id]);assert.equal(f.state.saved.options.usePantry,false);await check(await f.api.POST(f.request({items:[{canonicalItem:'banana'}]})),200);assert.equal(f.state.saved.owner,'synthetic-owner');assert.equal(f.state.saved.items[0].canonicalItem,'banana');});
test('unexpected query errors remain redacted and noncacheable',async()=>{const f=fixture();f.state.fail=true;const response=await check(await f.api.POST(f.request({recipeIds:[id]})),500);assert.equal(JSON.stringify(response).includes('synthetic private'),false);assert.equal(f.state.logs.join(' ').includes('synthetic private'),false);});

test('invalid loose items and oversized bodies refuse every shopping mutation',async()=>{for(const body of [{items:[{canonicalItem:''}]},{items:Array(101).fill({canonicalItem:'banana'})},{recipeIds:[id],extra:'x'.repeat(66000)},null]){const f=fixture();await check(await f.api.POST(f.request(body)),400);assert.equal(f.state.calls.length,0);}});
test('empty legacy selection and the bounded recipe selection remain accepted',async()=>{for(const body of [{},{recipeIds:[]},{recipeIds:Array(100).fill(id),skipStaples:false,skipOptional:false,usePantry:false}]){const f=fixture();await check(await f.api.POST(f.request(body)),200);assert.equal(f.state.calls.join(','),'recipes');}});
