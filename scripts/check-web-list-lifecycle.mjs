// Actual web recipe shopping button; synthetic React/router/client only.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';
const mocks={
 react:`export const useCallback=fn=>fn;export const useState=v=>{const i=state.cursor++;if(!(i in state.values))state.values[i]=v;return[state.values[i],v=>{state.writes++;state.values[i]=typeof v==='function'?v(state.values[i]):v;}];};export const useRef=v=>state.values[state.cursor++]??={current:v};export const useEffect=(fn,deps)=>{const i=state.cursor++;if(!state.deps[i]||deps.some((v,n)=>v!==state.deps[i][n])){state.deps[i]=deps;state.effects.push(()=>{state.cleanups[i]?.();state.cleanups[i]=fn();});}};`,
 'react/jsx-runtime':`export const Fragment='Fragment';export const jsx=(type,props)=>({type,props});export const jsxs=jsx;`,
 '@/lib/action-failure':`export const actionFailure=(err,message)=>({message:err instanceof Error?err.message:message,signInRequired:false});`,
 '@/ui':`export const Button='Button';`,
 'next/navigation':`export const useRouter=()=>({push:path=>state.routes.push(path)});`,
 '@seconds/core/format':`export {isUuid} from './packages/core/src/ids.ts';`,
 '@/lib/client':`export const api={getList:()=>state.read(),cartProviders:async()=>[],setListItemChecked:(...args)=>{state.calls.push(['toggle',...args]);return state.save();},removeListItem:id=>{state.calls.push(['remove',id]);return state.save();},clearList:()=>{state.calls.push(['clear']);return state.save();},addRecipesToList:ids=>{state.calls.push(['recipes',ids]);return state.save();},addItemsToList:items=>{state.calls.push(['items',items]);return state.save();}};`,
};
const bundle=await build({bundle:true,write:false,format:'iife',globalName:'app',jsx:'automatic',stdin:{resolveDir:process.cwd(),contents:"export {useShoppingList} from './apps/web/modules/list/useShoppingList.ts';"},plugins:[{name:'web-recipe-shopping',setup(api){api.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'mock'}:undefined);api.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js',resolveDir:process.cwd()}));}}]});

const initial={id:'10000000-0000-4000-8000-000000000001',itemCount:1,checkedCount:0,items:[{id:'10000000-0000-4000-8000-000000000002',canonicalItem:'tomato',displayName:'tomato',quantity:null,unit:null,checked:false,recipeIds:[]}]};
const flush=async()=>{for(let n=0;n<15;n++)await Promise.resolve();};
function fixture(){
 const state={writes:0,cursor:0,values:[],deps:[],cleanups:[],effects:[],calls:[]};state.read=async()=>initial;state.save=async()=>initial;
 const context={state};runInNewContext(bundle.outputFiles[0].text,context);
 const render=()=>{state.cursor=0;const result=context.app.useShoppingList();while(state.effects.length)state.effects.shift()();return result;};
 render();return{state,render,unmount:()=>state.cleanups.forEach(fn=>fn?.())};
}
test('pending different list actions dispatch only once',async()=>{
 const f=fixture();await flush();let finish;f.state.save=()=>new Promise(resolve=>finish=resolve);const c=f.render();
 const first=c.toggle(initial.items[0].id,true),second=c.clear();assert.equal(f.state.calls.length,1);
 assert.equal(f.render().list.items[0].checked,false);finish({...initial,checkedCount:1,items:[{...initial.items[0],checked:true}]});await Promise.all([first,second]);assert.equal(f.render().list.checkedCount,1);
});
test('retained actions and late writes after unmount do not dispatch or update',async()=>{
 const f=fixture();await flush();let finish;f.state.save=()=>new Promise(resolve=>finish=resolve);const c=f.render();
 const pending=c.remove(initial.items[0].id);f.unmount();const writes=f.state.writes;finish(initial);await pending;
 assert.equal(f.state.writes,writes);await c.clear();assert.equal(f.state.calls.length,1);
});
test('list refresh blocks mutation dispatch until its read settles',async()=>{
 const f=fixture();await flush();let finishRead;f.state.read=()=>new Promise(resolve=>finishRead=resolve);f.render().retryList();const c=f.render();
 await c.clear();finishRead(initial);await flush();assert.equal(f.render().list.itemCount,1); // refresh must block dispatch while reading
 assert.equal(f.state.calls.length,0);
});
test('failed checkbox save preserves confirmed state and warns of uncertainty',async()=>{
 const f=fixture();await flush();f.state.save=async()=>{throw Error('private failure');};await f.render().toggle(initial.items[0].id,false);
 assert.equal(f.render().list.items[0].checked,false);assert.match(f.render().error.message,/unconfirmed|may still finish/i);assert.doesNotMatch(f.render().error.message,/private failure/);
});
