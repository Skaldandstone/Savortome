// Actual route and shared auth/error wrapper; synthetic session, DB and providers.
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
    export const guessIngredientNutrition=async()=>{state.calls.push('guess');if(state.fail)throw Error('private food and provider diagnostic');return [];};
    export const computeNutrition=async()=>{state.calls.push('compute');return state.nutrition;};`,
  '@seconds/db': classes(['PantryIntakeNotFoundError','SaveRecipeError','SaveTemplateError','SuggestionError']) + `
    export const db=()=>({});
    export const getRecipe=async(db,owner,id)=>{state.calls.push('read');state.owner=owner;return state.recipe;};
    export const setRecipeNutrition=async(...args)=>{state.calls.push('save');state.snapshot=args[4];return state.saved;};`,
  '@/lib/session': classes(['NotConfiguredError','NotSignedInError']) + `export const databaseConfigured=()=>true;export const requireUserId=async()=>{if(!state.signedIn)throw new NotSignedInError('Sign in.');return 'fixture-owner';};`,
  '@/lib/generation-audit': 'export const recordGenerationAudit=()=>{};',
};
const bundle = await build({ bundle:true,write:false,platform:'node',format:'iife',globalName:'app',stdin:{resolveDir:process.cwd(),contents:"export {POST} from './apps/web/app/api/recipes/[id]/nutrition/route.ts';"},plugins:[{name:'nutrition-api',setup(api){
  api.onResolve({filter:/.*/},args=>{
    if(args.path==='./session')return{path:'@/lib/session',namespace:'mock'};
    if(Object.hasOwn(mocks,args.path))return{path:args.path,namespace:'mock'};
    if(args.path.startsWith('@/lib/'))return{path:root+'/apps/web/'+args.path.slice(2)+'.ts'};
  });
  api.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js'}));
}}] });
function fixture() {
  const state={calls:[],logs:[],signedIn:true,saved:true,recipe:{ingredients:[{item:'rice'}],servings:2,nutrition:null},nutrition:{perServing:{calories:100}}};
  const context={state,Response,console:{error:(...args)=>state.logs.push(args.join(' '))}};
  runInNewContext(bundle.outputFiles[0].text,context);
  return {state,post:()=>context.app.POST({}, {params:Promise.resolve({id:'10000000-0000-4000-8000-000000000001'})})};
}
test('signed-out and absent recipes never reach nutrition providers',async()=>{
  const f=fixture();f.state.signedIn=false;assert.equal((await f.post()).status,401);assert.deepEqual(f.state.calls,[]);
  f.state.signedIn=true;f.state.recipe=null;assert.equal((await f.post()).status,404);assert.deepEqual(f.state.calls,['read']);
});
test('existing figures return without provider or persistence calls',async()=>{
  const f=fixture();f.state.recipe.nutrition=f.state.nutrition;const response=await f.post();
  assert.equal(response.status,200);assert.deepEqual(f.state.calls,['read']);
});
test('successful calculation carries its exact reviewed inputs into persistence',async()=>{
  const f=fixture();const response=await f.post();assert.equal(response.status,200);
  assert.equal(f.state.snapshot,f.state.recipe);assert.equal(f.state.owner,'fixture-owner');
  assert.deepEqual(f.state.calls,['read','guess','compute','save']);
});
test('refused stale estimate returns review conflict without computed figures or retry',async()=>{
  const f=fixture();f.state.saved=false;const response=await f.post();assert.equal(response.status,409);
  const body=await response.json();assert.match(body.error,/Reload/);assert.equal(body.nutrition,undefined);
  assert.deepEqual(f.state.calls,['read','guess','compute','save']);
});
test('unexpected provider failure withholds private food diagnostics from logs and response',async()=>{
  const f=fixture();f.state.fail=true;const response=await f.post();assert.equal(response.status,500);
  assert.doesNotMatch(JSON.stringify(await response.json()),/private food/);
  assert.doesNotMatch(f.state.logs.join(' '),/private food/);
  assert.deepEqual(f.state.calls,['read','guess']);
});
