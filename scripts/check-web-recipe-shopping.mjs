// Actual web recipe shopping button; synthetic React/router/client only.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';
const mocks={
 react:`export const useState=v=>{const i=state.cursor++;if(!(i in state.values))state.values[i]=v;return[state.values[i],v=>{state.writes++;state.values[i]=typeof v==='function'?v(state.values[i]):v;}];};export const useRef=v=>state.values[state.cursor++]??={current:v};export const useEffect=(fn,deps)=>{const i=state.cursor++;if(!state.deps[i]||deps.some((v,n)=>v!==state.deps[i][n])){state.deps[i]=deps;state.effects.push(()=>{state.cleanups[i]?.();state.cleanups[i]=fn();});}};`,
 'react/jsx-runtime':`export const Fragment='Fragment';export const jsx=(type,props)=>({type,props});export const jsxs=jsx;`,
 '@/ui':`export const Button='Button';`,
 'next/navigation':`export const useRouter=()=>({push:path=>state.routes.push(path)});`,
 '@seconds/core/format':`export {isUuid} from './packages/core/src/ids.ts';`,
 '@/lib/client':`export const api={addRecipesToList:async ids=>{state.calls.push(ids);return state.save();}};`,
};
const bundle=await build({bundle:true,write:false,format:'iife',globalName:'app',jsx:'automatic',stdin:{resolveDir:process.cwd(),contents:"export {AddToListButton} from './apps/web/modules/list/AddToListButton.tsx';"},plugins:[{name:'web-recipe-shopping',setup(api){api.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'mock'}:undefined);api.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js',resolveDir:process.cwd()}));}}]});
const id='10000000-0000-4000-8000-000000000001',listId='10000000-0000-4000-8000-000000000002';
const nodes=t=>Array.isArray(t)?t.flatMap(nodes):t&&typeof t==='object'?[t,...nodes(t.props?.children)]:[];
const text=t=>Array.isArray(t)?t.map(text).join(' '):t&&typeof t==='object'?text(t.props?.children):t==null?'':String(t);
const flush=async()=>{for(let n=0;n<10;n++)await Promise.resolve();};
function fixture(result={id:listId,items:[]}){const state={writes:0,cursor:0,values:[],deps:[],cleanups:[],effects:[],calls:[],routes:[]};state.save=async()=>result;const context={state};runInNewContext(bundle.outputFiles[0].text,context);const render=()=>{state.cursor=0;let tree=context.app.AddToListButton({recipeId:id});while(typeof tree?.type==='function')tree=tree.type(tree.props);while(state.effects.length)state.effects.shift()();return tree;};const button=()=>nodes(render()).find(n=>n.type==='Button');return{state,render,button,click:()=>button().props.onClick({preventDefault(){},stopPropagation(){}}),copy:()=>text(render()),unmount:()=>state.cleanups.forEach(fn=>fn?.())};}
test('empty response confirms review without saying the recipe is on the list',async()=>{const f=fixture();await f.click();assert.doesNotMatch(f.copy(),/On your list/);assert.match(f.copy(),/request completed/);await f.click();assert.equal(f.state.calls.length,1);assert.deepEqual(f.state.routes,['/list']);});
test('malformed or rejected response stays uncertain and click reviews without retry',async()=>{for(const result of [null,{}, {id:'bad',items:[]},{id:listId,items:[{}]}]){const f=fixture(result);await f.click();assert.match(f.copy(),/unconfirmed/i);await f.click();assert.equal(f.state.calls.length,1);assert.deepEqual(f.state.routes,['/list']);}});
test('duplicate pending events dispatch only once and expose busy state',async()=>{const f=fixture();let finish;f.state.save=()=>new Promise(resolve=>finish=resolve);const first=f.click();assert.equal(f.button().props['aria-busy'],true);const second=f.click();assert.equal(f.state.calls.length,1);finish({id:listId,items:[]});await Promise.all([first,second]);});
test('retained handler after unmount sends no request',async()=>{const f=fixture();const handler=f.button().props.onClick;f.unmount();await handler({preventDefault(){},stopPropagation(){}});assert.equal(f.state.calls.length,0);});
test('late response after unmount cannot confirm or navigate',async()=>{const f=fixture();let finish;f.state.save=()=>new Promise(resolve=>finish=resolve);const pending=f.click();f.unmount();const writes=f.state.writes;finish({id:listId,items:[]});await pending;assert.equal(f.state.writes,writes);await flush();assert.doesNotMatch(f.copy(),/request completed/);assert.equal(f.state.routes.length,0);});

test('rejected write reviews the existing list without resending private failure',async()=>{const f=fixture();f.state.save=async()=>{throw Error('synthetic private transport');};await f.click();assert.match(f.copy(),/unconfirmed/i);assert.doesNotMatch(f.copy(),/synthetic private/);await f.click();assert.equal(f.state.calls.length,1);assert.deepEqual(f.state.routes,['/list']);});
test('valid populated response retains unstated amounts and requires list review',async()=>{const f=fixture({id:listId,items:[{id:'10000000-0000-4000-8000-000000000003',canonicalItem:'tomato',quantity:null,unit:null,checked:false,recipeIds:[id]}]});await f.click();assert.match(f.copy(),/request completed/);await f.click();assert.equal(f.state.calls.length,1);assert.deepEqual(f.state.routes,['/list']);});
