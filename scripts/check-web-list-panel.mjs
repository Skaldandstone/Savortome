// Actual ListPanel and shopping hook; synthetic component renderer, Clerk/client/children.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';
const react=`const slot=()=>{const f=state.fiber;return[f,f.cursor++];};const changed=(a,b)=>!a||b.some((v,n)=>v!==a[n]);
export const useState=v=>{const[f,i]=slot();if(!(i in f.values))f.values[i]=v;return[f.values[i],v=>{state.writes++;f.values[i]=typeof v==='function'?v(f.values[i]):v;}];};
export const useRef=v=>{const[f,i]=slot();return f.values[i]??={current:v};};
export const useMemo=(fn,deps)=>{const[f,i]=slot();if(changed(f.deps[i],deps)){f.deps[i]=deps;f.values[i]=fn();}return f.values[i];};
export const useCallback=fn=>fn;export const useEffect=(fn,deps)=>{const[f,i]=slot();if(changed(f.deps[i],deps)){f.deps[i]=deps;state.effects.push(()=>{f.cleanups[i]?.();f.cleanups[i]=fn();});}};`;
const client=`const make=scope=>({getList:()=>state.read(scope),cartProviders:async()=>[],clearList:()=>{state.calls.push(['clear',scope]);return state.save(scope);},removeListItem:id=>{state.calls.push(['remove',scope,id]);return state.save(scope);}});export const api=make('local');export const scopedClient=scope=>make(scope);`;
const mocks={react,'react/jsx-runtime':`export const Fragment='Fragment';export const jsx=(type,props,key)=>({type,props,key});export const jsxs=jsx;`,
 '@clerk/nextjs':`export const useAuth=()=>state.auth;`,
 '@seconds/core/format':`export {isUuid} from './packages/core/src/ids.ts';import {scopedClient} from '@/lib/client';export const createClient=config=>{state.scopes.push(config);return scopedClient(config.expectedSessionId);};`,
 '@/lib/client':client,'@/lib/action-failure':`export const actionFailure=(err,message)=>({message,signInRequired:false});export const signInReturnHref=path=>'/sign-in?redirect='+path;`,
 'next/link':`export default 'Link';`,'@/ui':`export const Button='Button',Callout='Callout',Panel='Panel',PanelHeader='PanelHeader';`,
 './CartButtons':`export const CartButtons='CartButtons';`,'./KrogerConnection':`export const KrogerConnection='KrogerConnection';`,'./ListItems':`export const ListItems='ListItems';`};
const bundle=await build({bundle:true,write:false,format:'iife',globalName:'app',jsx:'automatic',stdin:{resolveDir:process.cwd(),contents:"export {ListPanel} from './apps/web/modules/list/ListPanel.tsx';"},plugins:[{name:'list-panel-fixture',setup(api){api.onResolve({filter:/.*/},a=>Object.hasOwn(mocks,a.path)?{path:a.path,namespace:'mock'}:a.path.endsWith('.css')?{path:a.path,namespace:'css'}:undefined);api.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js',resolveDir:process.cwd()}));api.onLoad({filter:/.*/,namespace:'css'},()=>({contents:'export default {};',loader:'js'}));}}]});
const initial={id:'10000000-0000-4000-8000-000000000001',itemCount:1,checkedCount:0,items:[{id:'10000000-0000-4000-8000-000000000002',canonicalItem:'tomato',displayName:'tomato',quantity:null,unit:null,checked:false,recipeIds:[]}]};
const flush=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
const nodes=t=>Array.isArray(t)?t.flatMap(nodes):t&&typeof t==='object'?[t,...nodes(t.props?.children)]:[];
const text=t=>Array.isArray(t)?t.map(text).join(' '):t&&typeof t==='object'?text(t.props?.children):t==null?'':String(t);
function fixture(clerkEnabled=true){
 const state={auth:{isLoaded:true,userId:'user-a',sessionId:'session-a'},scopes:[],calls:[],writes:0,effects:[],fibers:new Map()};state.read=async()=>initial;state.save=async()=>initial;
 const context={state,URL};runInNewContext(bundle.outputFiles[0].text,context);
 function walk(t,path,used){
  if(Array.isArray(t))return t.map((x,i)=>walk(x,path+':'+i,used));if(!t||typeof t!=='object')return t;
  if(typeof t.type==='function'){const key=path+':'+t.type.name+':'+(t.key??'');used.add(key);let f=state.fibers.get(key);if(!f){f={values:[],deps:[],cleanups:[],cursor:0};state.fibers.set(key,f);}f.cursor=0;state.fiber=f;return walk(t.type(t.props),key,used);}
  return {...t,props:{...t.props,children:walk(t.props?.children,path+':children',used)}};
 }
 const render=(effects=true)=>{const used=new Set();const tree=walk({type:context.app.ListPanel,props:{clerkEnabled}},'root',used);for(const[key,f]of state.fibers){if(!used.has(key)){state.effects.push(()=>f.cleanups.forEach(fn=>fn?.()));state.fibers.delete(key);}}if(effects)while(state.effects.length)state.effects.shift()();return tree;};
 const button=label=>nodes(render()).find(n=>n.type==='Button'&&text(n)===label);
 render();return {state,render,button};
}
test('local mode loads without Clerk client construction',async()=>{const f=fixture(false);await flush();assert.equal(f.state.scopes.length,0);assert.ok(nodes(f.render()).find(n=>n.type==='ListItems'));});
test('loading and signed-out wrapper conceal private list and actions',async()=>{const f=fixture();await flush();f.state.auth={isLoaded:false,userId:null,sessionId:null};assert.match(text(f.render(false)),/Loading your sign-in/);assert.equal(nodes(f.render(false)).filter(n=>n.type==='ListItems').length,0);f.state.auth.isLoaded=true;assert.match(text(f.render()),/Sign in again/);assert.equal(nodes(f.render()).filter(n=>n.type==='Button').length,0);assert.equal(f.state.scopes.at(-1).expectedSessionId,'signed-out');});
test('account replacement hides old list before effects and loads scoped replacement',async()=>{const f=fixture();await flush();assert.equal(nodes(f.render()).find(n=>n.type==='ListItems').props.items[0].displayName,'tomato');f.state.auth={isLoaded:true,userId:'user-b',sessionId:'session-b'};let finish;f.state.read=()=>new Promise(resolve=>finish=resolve);assert.equal(nodes(f.render(false)).filter(n=>n.type==='ListItems').length,0);f.render();assert.equal(f.state.scopes.at(-1).expectedSessionId,'session-b');finish({...initial,items:[{...initial.items[0],displayName:'carrot'}]});await flush();assert.equal(nodes(f.render()).find(n=>n.type==='ListItems').props.items[0].displayName,'carrot');});
test('session replacement resets clear confirmation and ignores retained old actions',async()=>{const f=fixture();await flush();f.button('Clear list').props.onClick();const old=f.button('Clear every item').props.onClick;f.state.auth.sessionId='session-b';f.render(false);old();assert.equal(f.state.calls.length,0);f.render();await flush();assert.equal(f.button('Clear every item'),undefined);f.button('Clear list').props.onClick();f.button('Clear every item').props.onClick();await flush();assert.equal(f.state.calls[0][1],'session-b');});
test('old response cannot populate replacement session before passive cleanup',async()=>{const f=fixture();await flush();let finish;f.state.save=()=>new Promise(resolve=>finish=resolve);f.button('Clear list').props.onClick();f.button('Clear every item').props.onClick();f.state.auth.sessionId='session-b';f.render(false);const writes=f.state.writes;finish({...initial,itemCount:0,items:[]});await flush();assert.equal(f.state.writes,writes);assert.equal(nodes(f.render(false)).filter(n=>n.type==='ListItems').length,0);f.render();await flush();assert.equal(nodes(f.render()).find(n=>n.type==='ListItems').props.items.length,1);});
