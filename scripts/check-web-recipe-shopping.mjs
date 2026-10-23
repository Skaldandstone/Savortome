// Actual web recipe shopping button; synthetic React/router/client only.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';
const mocks={
 react:`export const useMemo=(fn,deps)=>{const i=state.cursor++;if(!state.deps[i]||deps.some((v,n)=>v!==state.deps[i][n])){state.deps[i]=deps;state.values[i]=fn();}return state.values[i];};export const useState=v=>{const i=state.cursor++;if(!(i in state.values))state.values[i]=v;return[state.values[i],v=>{state.writes++;state.values[i]=typeof v==='function'?v(state.values[i]):v;}];};export const useRef=v=>state.values[state.cursor++]??={current:v};export const useEffect=(fn,deps)=>{const i=state.cursor++;if(!state.deps[i]||deps.some((v,n)=>v!==state.deps[i][n])){state.deps[i]=deps;state.effects.push(()=>{state.cleanups[i]?.();state.cleanups[i]=fn();});}};`,
 '@clerk/nextjs':`export const useAuth=()=>state.auth;`,
 'react/jsx-runtime':`export const Fragment='Fragment';export const jsx=(type,props)=>({type,props});export const jsxs=jsx;`,
 '@/ui':`export const Button='Button';`,
 'next/navigation':`export const useRouter=()=>({push:path=>state.routes.push(path)});`,
 '@seconds/core/format':`export {isUuid} from './packages/core/src/ids.ts'; import {api} from '@/lib/client'; export const createClient=config=>{(state.scopes??=[]).push(config);return {...api};};`,
 '@/lib/client':`export const api={addRecipesToList:async ids=>{state.calls.push(ids);return state.save();},addItemsToList:async items=>{state.calls.push(items);return state.save();}};`,
};
const bundle=await build({bundle:true,write:false,format:'iife',globalName:'app',jsx:'automatic',stdin:{resolveDir:process.cwd(),contents:"export {AddToListButton,AddMissingButton} from './apps/web/modules/list/AddToListButton.tsx'; export {api} from '@/lib/client';"},plugins:[{name:'web-recipe-shopping',setup(api){api.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'mock'}:undefined);api.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js',resolveDir:process.cwd()}));}}]});
const id='10000000-0000-4000-8000-000000000001',listId='10000000-0000-4000-8000-000000000002';
const nodes=t=>Array.isArray(t)?t.flatMap(nodes):t&&typeof t==='object'?[t,...nodes(t.props?.children)]:[];
const text=t=>Array.isArray(t)?t.map(text).join(' '):t&&typeof t==='object'?text(t.props?.children):t==null?'':String(t);
const flush=async()=>{for(let n=0;n<10;n++)await Promise.resolve();};
function fixture(result={id:listId,items:[]},clerkEnabled=false){const state={writes:0,cursor:0,values:[],deps:[],cleanups:[],effects:[],calls:[],routes:[]};state.auth={userId:'user-a',sessionId:'session-a',isLoaded:true};state.save=async()=>result;const context={state};runInNewContext(bundle.outputFiles[0].text,context);const render=()=>{state.cursor=0;let tree=context.app.AddToListButton({recipeId:id,clerkEnabled});while(typeof tree?.type==='function')tree=tree.type(tree.props);while(state.effects.length)state.effects.shift()();return tree;};const button=()=>nodes(render()).find(n=>n.type==='Button');return{state,render,button,click:()=>button().props.onClick({preventDefault(){},stopPropagation(){}}),copy:()=>text(render()),unmount:()=>state.cleanups.forEach(fn=>fn?.())};}
test('empty response confirms review without saying the recipe is on the list',async()=>{const f=fixture();await f.click();assert.doesNotMatch(f.copy(),/On your list/);assert.match(f.copy(),/request completed/);await f.click();assert.equal(f.state.calls.length,1);assert.deepEqual(f.state.routes,['/list']);});
test('malformed or rejected response stays uncertain and click reviews without retry',async()=>{for(const result of [null,{}, {id:'bad',items:[]},{id:listId,items:[{}]}]){const f=fixture(result);await f.click();assert.match(f.copy(),/unconfirmed/i);await f.click();assert.equal(f.state.calls.length,1);assert.deepEqual(f.state.routes,['/list']);}});
test('duplicate pending events dispatch only once and expose busy state',async()=>{const f=fixture();let finish;f.state.save=()=>new Promise(resolve=>finish=resolve);const first=f.click();assert.equal(f.button().props['aria-busy'],true);const second=f.click();assert.equal(f.state.calls.length,1);finish({id:listId,items:[]});await Promise.all([first,second]);});
test('retained handler after unmount sends no request',async()=>{const f=fixture();const handler=f.button().props.onClick;f.unmount();await handler({preventDefault(){},stopPropagation(){}});assert.equal(f.state.calls.length,0);});
test('late response after unmount cannot confirm or navigate',async()=>{const f=fixture();let finish;f.state.save=()=>new Promise(resolve=>finish=resolve);const pending=f.click();f.unmount();const writes=f.state.writes;finish({id:listId,items:[]});await pending;assert.equal(f.state.writes,writes);await flush();assert.doesNotMatch(f.copy(),/request completed/);assert.equal(f.state.routes.length,0);});

test('rejected write reviews the existing list without resending private failure',async()=>{const f=fixture();f.state.save=async()=>{throw Error('synthetic private transport');};await f.click();assert.match(f.copy(),/unconfirmed/i);assert.doesNotMatch(f.copy(),/synthetic private/);await f.click();assert.equal(f.state.calls.length,1);assert.deepEqual(f.state.routes,['/list']);});
test('valid populated response retains unstated amounts and requires list review',async()=>{const f=fixture({id:listId,items:[{id:'10000000-0000-4000-8000-000000000003',canonicalItem:'tomato',quantity:null,unit:null,checked:false,recipeIds:[id]}]});await f.click();assert.match(f.copy(),/request completed/);await f.click();assert.equal(f.state.calls.length,1);assert.deepEqual(f.state.routes,['/list']);});

function missingFixture(result={id:listId,items:[]}) {
 const state={writes:0,cursor:0,values:[],deps:[],cleanups:[],effects:[],calls:[],routes:[]};
 state.auth={userId:'user-a',sessionId:'session-a',isLoaded:true};state.save=async()=>result;const context={state};runInNewContext(bundle.outputFiles[0].text,context);
 const props={api:context.app.api,missing:['tomato'],onAdded:()=>state.added=(state.added??0)+1};
 const render=()=>{state.cursor=0;const tree=context.app.AddMissingButton(props);while(state.effects.length)state.effects.shift()();return tree;};
 const button=()=>nodes(render()).find(n=>n.type==='Button');
 return {state,props,render,button,copy:()=>text(render()),click:()=>button().props.onClick({preventDefault(){},stopPropagation(){}}),unmount:()=>state.cleanups.forEach(fn=>fn?.())};
}
const tomato={id:'10000000-0000-4000-8000-000000000003',canonicalItem:'tomato',quantity:null,unit:null,checked:false,recipeIds:[]};
test('missing action only confirms matching well-formed rows',async()=>{
 for(const result of [null,{}, {id:listId,items:[]},{id:listId,items:[{}]}, {id:listId,items:[{...tomato,canonicalItem:'carrot'}]}]){
 const f=missingFixture(result);await f.click();assert.match(f.copy(),/unconfirmed/i);assert.equal(f.state.added??0,0);await f.click();assert.equal(f.state.calls.length,1);assert.deepEqual(f.state.routes,['/list']);}
 const f=missingFixture({id:listId,items:[tomato]});await f.click();assert.equal(f.state.added,1);assert.match(f.copy(),/Review shopping list/);await f.click();assert.equal(f.state.calls.length,1);
});
test('missing duplicate pending event is locked synchronously',async()=>{
 const f=missingFixture();let finish;f.state.save=()=>new Promise(resolve=>finish=resolve);
 const first=f.click(),second=f.click();assert.equal(f.state.calls.length,1);assert.equal(f.button().props['aria-busy'],true);
 finish({id:listId,items:[tomato]});await Promise.all([first,second]);
});
test('missing late and retained unmounted handlers do not update or dispatch',async()=>{
 const f=missingFixture();let finish;f.state.save=()=>new Promise(resolve=>finish=resolve);
 const handler=f.button().props.onClick,pending=f.click();f.unmount();const writes=f.state.writes;
 finish({id:listId,items:[tomato]});await pending;assert.equal(f.state.writes,writes);assert.equal(f.state.added??0,0);
 await handler({preventDefault(){},stopPropagation(){}});assert.equal(f.state.calls.length,1);
});
test('changed missing selection cannot receive an older onAdded callback',async()=>{
 const f=missingFixture();let finish;f.state.save=()=>new Promise(resolve=>finish=resolve);
 const pending=f.click();f.props.missing=['carrot'];f.render();finish({id:listId,items:[tomato]});await pending;
 assert.equal(f.state.added??0,0);assert.match(f.copy(),/Review shopping list/);await f.click();assert.equal(f.state.calls.length,1);
});
test('missing rejection hides private errors and does not automatically retry',async()=>{
 const f=missingFixture();f.state.save=async()=>{throw Error('private transport detail');};await f.click();
 assert.match(f.copy(),/unconfirmed/i);assert.doesNotMatch(f.copy(),/private transport detail/);await f.click();assert.equal(f.state.calls.length,1);
});

test('retained missing handler cannot dispatch an obsolete selection',async()=>{
 const f=missingFixture();const handler=f.button().props.onClick;f.props.missing=['carrot'];f.render();
 await handler({preventDefault(){},stopPropagation(){}});assert.equal(f.state.calls.length,0);
});
test('missing completion never invokes a replacement callback or hides review on empty match',async()=>{
 const f=missingFixture();let finish;f.state.save=()=>new Promise(resolve=>finish=resolve);
 const pending=f.click();f.props.onAdded=()=>{throw Error('replacement callback');};f.props.missing=[];f.render();
 finish({id:listId,items:[tomato]});await pending;assert.equal(f.state.added??0,0);assert.match(f.copy(),/Review shopping list/);
});
test('missing names are trimmed and deduplicated without assigning quantities',async()=>{
 const f=missingFixture({id:listId,items:[tomato]});f.props.missing=[' tomato ','tomato',' '];await f.click();
 assert.equal(JSON.stringify(f.state.calls),JSON.stringify([[{canonicalItem:'tomato'}]]));assert.equal(f.state.added,1);
});

test('missing old client handlers and response cannot affect a replacement before cleanup',async()=>{
 const f=missingFixture({id:listId,items:[tomato]});let finish;f.state.save=()=>new Promise(resolve=>finish=resolve);
 const retained=f.button().props.onClick,pending=f.click();f.props.api={...f.props.api};f.render();const writes=f.state.writes;
 finish({id:listId,items:[tomato]});await pending;assert.equal(f.state.writes,writes);assert.equal(f.state.added??0,0);
 await retained({preventDefault(){},stopPropagation(){}});assert.equal(f.state.calls.length,1);
});

test('recipe current client is pinned and old-session response and handler are ignored',async()=>{
 const f=fixture({id:listId,items:[]},true);let finish;f.state.save=()=>new Promise(resolve=>finish=resolve);
 const handler=f.button().props.onClick,pending=f.click();assert.equal(f.state.scopes[0].expectedSessionId,'session-a');
 f.state.auth={userId:'user-a',sessionId:'session-b',isLoaded:true};f.render();const writes=f.state.writes;
 finish({id:listId,items:[]});await pending;assert.equal(f.state.writes,writes);assert.equal(f.state.scopes.at(-1).expectedSessionId,'session-b');
 await handler({preventDefault(){},stopPropagation(){}});assert.equal(f.state.calls.length,1);
});
test('recipe loading or signed-out auth does not expose an addition',()=>{
 const f=fixture(undefined,true);f.state.auth={userId:null,sessionId:null,isLoaded:false};assert.equal(f.button(),undefined);
 f.state.auth={userId:null,sessionId:null,isLoaded:true};assert.equal(f.button(),undefined);assert.equal(f.state.calls.length,0);
});
