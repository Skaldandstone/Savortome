// Actual account recipe screen with synthetic native hooks, focus and client.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
const source='apps/mobile/app/(protected)/recipe/[id]/index.tsx';
const mocks={
 react:`export const useState=v=>{const i=state.cursor++;if(!(i in state.values))state.values[i]=typeof v==='function'?v():v;return[state.values[i],v=>state.values[i]=typeof v==='function'?v(state.values[i]):v];};export const useRef=v=>state.values[state.cursor++]??={current:v};export const useCallback=(fn,deps)=>{const i=state.cursor++;if(!state.deps[i]||deps.some((v,n)=>v!==state.deps[i][n])){state.deps[i]=deps;state.values[i]=fn;}return state.values[i];};export const useMemo=fn=>fn();export const useEffect=(fn,deps)=>{const i=state.cursor++;if(!state.deps[i]||deps.some((v,n)=>v!==state.deps[i][n])){state.cleanups[i]?.();state.deps[i]=deps;state.effects.push(()=>state.cleanups[i]=fn());}};`,
 'react/jsx-runtime':`export const Fragment='Fragment';export const jsx=(type,props)=>({type,props});export const jsxs=jsx;`,
 'react-native':`export const ActivityIndicator='ActivityIndicator',ScrollView='ScrollView',Text='Text',View='View';export const StyleSheet={create:x=>x};export const Alert={alert:(...args)=>state.alerts.push(args)};`,
 'expo-router':`import {useEffect} from 'react';export const Stack={Screen:'Screen'};export const useRouter=()=>({push:path=>state.routes.push(path)});export const useLocalSearchParams=()=>({});export const useFocusEffect=fn=>useEffect(()=>{state.focus=fn;state.blur=fn();return()=>state.blur?.();},[fn]);`,
 '@clerk/expo':`export const useAuth=()=>({});`,
 'react-native-safe-area-context':`export const useSafeAreaInsets=()=>({bottom:0});`,
 '@seconds/core/format':`export {isUuid} from './packages/core/src/ids.ts';`,
 '@/lib/client':`export const createAccountClient=()=>state.client;`,
 '@/modules/recipe':`export const RecipeCard='RecipeCard';`,
 '@/modules/recipe/SavedMealReview':`export const SavedMealReview='SavedMealReview';`,
 '@/modules/sharing':`export const ShareControl='ShareControl';`,
 '@/ui':`export const Button='Button',Callout='Callout',space={lg:16,xxl:32,sm:8,md:12},usePalette=()=>({});`,
};
const bundle=await build({bundle:true,write:false,format:'iife',globalName:'screen',jsx:'automatic',stdin:{resolveDir:process.cwd(),contents:`export {AccountRecipeScreen} from './${source}';`},plugins:[{name:'recipe-shopping-fixture',setup(api){
 api.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'mock'}:undefined);
 api.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js',resolveDir:process.cwd()}));
 api.onLoad({filter:/index\.tsx$/},args=>args.path.replaceAll('\\','/').endsWith(source)?{contents:readFileSync(args.path,'utf8')+'\nexport {AccountRecipeScreen};',loader:'tsx'}:undefined);
}}]});
const id='10000000-0000-4000-8000-000000000001',listId='10000000-0000-4000-8000-000000000002';
const nodes=t=>Array.isArray(t)?t.flatMap(nodes):t&&typeof t==='object'?[t,...nodes(t.props?.children)]:[];
const text=t=>Array.isArray(t)?t.map(text).join(' '):t&&typeof t==='object'?text(t.props?.children):t==null?'':String(t);
const flush=async()=>{for(let n=0;n<12;n++)await Promise.resolve();};
function fixture(result={id:listId,items:[]}){const state={cursor:0,values:[],deps:[],cleanups:[],effects:[],calls:[],alerts:[],routes:[]};state.save=async()=>result;const client={getRecipe:async()=>({id,title:'Synthetic soup'}),addRecipesToList:async(ids)=>{state.calls.push(ids);return state.save();}};state.client=client;const context={state};runInNewContext(bundle.outputFiles[0].text,context);const render=()=>{state.cursor=0;const tree=context.screen.AccountRecipeScreen({id,client});while(state.effects.length)state.effects.shift()();return tree;};const button=label=>nodes(render()).find(n=>n.type==='Button'&&n.props.label===label);render();return{state,render,button,press:label=>button(label).props.onPress(),copy:()=>text(render())};}
test('empty confirmed list does not claim ingredients were added',async()=>{const f=fixture();await flush();f.press('Add ingredients to shopping list');await flush();assert.doesNotMatch(f.copy(),/Recipe ingredients added/);assert.match(f.copy(),/request completed/);});
test('malformed successful responses remain unconfirmed and cannot repeat',async()=>{for(const result of [null,{}, {id:'bad',items:[]},{id:listId,items:[{}]}]){const f=fixture(result);await flush();f.press('Add ingredients to shopping list');await flush();assert.ok(f.button('Check unconfirmed addition'));assert.match(f.copy(),/could not confirm/i);assert.equal(f.state.calls.length,1);}});
test('pending request exposes busy state and duplicate taps do not dispatch',async()=>{const f=fixture();await flush();let finish;f.state.save=()=>new Promise(resolve=>finish=resolve);f.press('Add ingredients to shopping list');const pending=f.button('Adding ingredients…');assert.equal(pending.props.busy,true);pending.props.onPress();assert.equal(f.state.calls.length,1);finish({id:listId,items:[]});await flush();});
test('late response after blur cannot announce a confirmed addition',async()=>{const f=fixture();await flush();let finish;f.state.save=()=>new Promise(resolve=>finish=resolve);f.press('Add ingredients to shopping list');f.state.blur();finish({id:listId,items:[]});await flush();assert.match(f.copy(),/unconfirmed/);assert.doesNotMatch(f.copy(),/request completed/);});

test('populated list with known or unstated quantity confirms review without automatic retry',async()=>{for(const quantity of [2,null]){const f=fixture({id:listId,items:[{id:'10000000-0000-4000-8000-000000000003',canonicalItem:'tomato',quantity,unit:quantity===null?null:'count',checked:false,recipeIds:[id]}]});await flush();f.press('Add ingredients to shopping list');await flush();assert.match(f.copy(),/request completed/);assert.equal(f.state.calls.length,1);assert.equal(f.button('Check unconfirmed addition'),undefined);}});
test('rejected request stays paused and sends no automatic retry',async()=>{const f=fixture();f.state.save=async()=>{throw Error('synthetic private transport');};await flush();f.press('Add ingredients to shopping list');await flush();assert.ok(f.button('Check unconfirmed addition'));assert.doesNotMatch(f.copy(),/synthetic private/);assert.equal(f.state.calls.length,1);});
