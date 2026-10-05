// Actual web pantry/search hooks; React/Clerk/client boundaries are synthetic.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';
const mocks={react:`export const useState=initial=>{const i=state.cursor++;if(!(i in state.values))state.values[i]=typeof initial==='function'?initial():initial;return[state.values[i],v=>{state.writes++;state.values[i]=typeof v==='function'?v(state.values[i]):v;}];};
 export const useRef=initial=>{const i=state.cursor++;return state.refs[i]??= {current:initial};};
 export const useMemo=(fn,deps)=>{const i=state.cursor++;if(!state.deps[i]||deps.some((v,n)=>v!==state.deps[i][n])){state.deps[i]=deps;state.memos[i]=fn();}return state.memos[i];};
 export const useCallback=(fn,deps)=>useMemo(()=>fn,deps);
 export const useEffect=(fn,deps)=>{const i=state.cursor++;if(!state.deps[i]||deps.some((v,n)=>v!==state.deps[i][n])){state.deps[i]=deps;state.effects.push(()=>{state.cleanups[i]?.();state.cleanups[i]=fn();});}};`, '@/lib/client':`export const api=Object.fromEntries(["listPantry","listPantryIntakes","addPantry","updatePantry","removePantry","clearPantry","resolvePantryIntake","searchPantry"].map(method=>[method,(...args)=>state.api[method](...args)]));`, '@/lib/action-failure':`export const actionFailure=(error,fallback)=>({message:error.message??fallback,signInRequired:false});`};
const bundle=await build({bundle:true,write:false,format:'iife',globalName:'pantry',stdin:{resolveDir:process.cwd(),contents:"export {usePantry,usePantrySearch} from './apps/web/modules/pantry/usePantry.ts';"},plugins:[{name:'web-pantry-lifecycle',setup(api){api.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'mock'}:undefined);api.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js'}));}}]});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function fixture(hookName='usePantry'){
 const state={cursor:0,values:[],refs:[],deps:[],memos:[],effects:[],cleanups:[],writes:0,calls:[],respond:async()=>[]};
 const client=()=>Object.fromEntries(['listPantry','listPantryIntakes','addPantry','updatePantry','removePantry','clearPantry','resolvePantryIntake','searchPantry'].map(method=>[method,async(...args)=>{state.calls.push({method,args});return state.respond(method,...args);} ]));
 const context={state};runInNewContext(bundle.outputFiles[0].text,context);let api=client();state.api=api;
 const render=(commit=true)=>{state.cursor=0;const hook=context.pantry[hookName](api);if(commit)state.effects.splice(0).forEach(fn=>fn());return hook;};
 const unmount=()=>state.cleanups.filter(Boolean).forEach(fn=>fn());
 return{state,render,unmount,replace:()=>{api=client();state.api=api;}};
}
const late={pantry:[{canonicalItem:'synthetic-old-food'}],intakes:[{id:'synthetic-old-review'}]};
test('web pantry: same-account session replacement invalidates pending review result',async()=>{
 const f=fixture(),old=f.render();await flush();const reply=deferred();f.state.respond=()=>reply.promise;const operation=old.resolveIntake('old-review','accept',['item']);
 f.state.respond=async()=>[];f.replace();f.render();await flush();reply.resolve(late);assert.equal(await operation,false);assert.deepEqual(Array.from(f.render().items),[]);
});
test('web pantry: current review still updates pantry and returns confirmed success',async()=>{
 const f=fixture(),current=f.render();await flush();f.state.respond=async()=>late;assert.equal(await current.resolveIntake('review','accept',['item']),true);
 assert.equal(f.render().items[0].canonicalItem,'synthetic-old-food');assert.equal(f.render().intakes[0].id,'synthetic-old-review');
});
test('web pantry: previous account data is hidden before new effect clears it',async()=>{
 const f=fixture(),old=f.render();await flush();f.state.respond=async()=>late;await old.resolveIntake('review','accept',['item']);assert.equal(f.render().items.length,1);
 f.replace();const next=f.render(false);assert.deepEqual(Array.from(next.items),[]);assert.deepEqual(Array.from(next.intakes),[]);assert.equal(next.loading,true);assert.equal(next.error,null);f.unmount();
});
test('web pantry search: retained unmounted action cannot dispatch or mutate state',async()=>{
 const f=fixture('usePantrySearch'),old=f.render();f.unmount();const calls=f.state.calls.length,writes=f.state.writes;await old.search('synthetic');assert.equal(f.state.calls.length,calls);assert.equal(f.state.writes,writes);
});
test('web pantry search: same-account session replacement invalidates pending result/error',async()=>{
 for(const reject of [false,true]){const f=fixture('usePantrySearch'),old=f.render(),reply=deferred();f.state.respond=()=>reply.promise;const operation=old.search('synthetic');f.replace();f.render();reject?reply.reject(Error('old-session diagnostic')):reply.resolve({marker:'old-session result'});await operation;
  const current=f.render();assert.equal(current.response,null);assert.equal(current.error,null);assert.equal(current.searching,false);
 }
});
test('web pantry search: retained old-account action cannot replace current results',async()=>{
 const f=fixture('usePantrySearch'),old=f.render();f.replace();const next=f.render();f.state.respond=async()=>({marker:'current result'});await next.search('current');const calls=f.state.calls.length;f.state.respond=async()=>({marker:'old result'});await old.search('old');assert.equal(f.state.calls.length,calls);assert.equal(f.render().response.marker,'current result');
});
test('web pantry search: old data hidden and pending result ignored before effect cleanup',async()=>{
 const f=fixture('usePantrySearch'),old=f.render();f.state.respond=async()=>({marker:'old result'});await old.search('synthetic');assert.equal(f.render().response.marker,'old result');const reply=deferred();f.state.respond=()=>reply.promise;const operation=old.search('pending');f.replace();const next=f.render(false);assert.equal(next.response,null);assert.equal(next.error,null);const writes=f.state.writes;reply.resolve({marker:'late old result'});await operation;assert.equal(f.state.writes,writes);f.unmount();
});
test('web pantry search: newer same-account search still wins out-of-order completion',async()=>{
 const f=fixture('usePantrySearch'),current=f.render(),first=deferred(),second=deferred();f.state.respond=(_method,query)=>query==='first'?first.promise:second.promise;
 const old=current.search('first'),next=current.search('second');second.resolve({marker:'second'});await next;first.resolve({marker:'first'});await old;assert.equal(f.render().response.marker,'second');assert.equal(f.render().searching,false);
});

test('web pantry: retained unmounted actions cannot dispatch',async()=>{
 const f=fixture(),old=f.render();await flush();f.unmount();const calls=f.state.calls.length,writes=f.state.writes;
 assert.equal(await old.add('synthetic'),false);assert.equal(await old.resolveIntake('review','dismiss'),false);old.retryPantry();old.retryIntakes();assert.equal(f.state.calls.length,calls);assert.equal(f.state.writes,writes);
});
test('web pantry: old-session write completion and error cannot update current data',async()=>{
 for(const reject of [false,true]){const f=fixture(),old=f.render();await flush();const reply=deferred();f.state.respond=()=>reply.promise;const operation=old.add('synthetic');f.state.respond=async()=>[];f.replace();f.render();await flush();reject?reply.reject(Error('old diagnostic')):reply.resolve(late.pantry);assert.equal(await operation,false);assert.equal(f.render().items.length,0);assert.equal(f.render().error,null);}
});

test('web pantry: same-session failed refresh keeps the last confirmed pantry with an error',async()=>{
 const f=fixture();f.state.respond=async method=>method==='listPantry'?late.pantry:late.intakes;f.render();await flush();assert.equal(f.render().loaded,true);
 f.state.respond=async()=>{throw Error('synthetic refresh failure');};f.render().retryPantry();f.render();await flush();const next=f.render();assert.equal(next.items.length,1);assert.equal(next.loaded,true);assert.equal(next.loading,false);assert.equal(next.pantryError.message,'synthetic refresh failure');
});
test('web pantry: old initial load cannot publish during a new-session render before cleanup',async()=>{
 const f=fixture(),reply=deferred();f.state.respond=()=>reply.promise;f.render();f.replace();f.render(false);const writes=f.state.writes;reply.resolve([]);await flush();assert.equal(f.state.writes,writes);f.unmount();
});
const shellMocks={
 react:`export const useMemo=fn=>fn();export const useState=initial=>{if(!state.content)throw Error('content unexpectedly rendered');const value=state.cursor++===1?true:initial;return[value,()=>{}];};`,
 'react/jsx-runtime':`export const jsx=(type,props)=>({type,props});export const jsxs=jsx;export const Fragment="fragment";`,
 '@clerk/nextjs':`export const useAuth=()=>{state.authReads++;return state.auth;};`,
 '@seconds/core/format':`export const createClient=config=>{state.configs.push(config);return{config};};`,
 '@/lib/client':`export const api={local:true};`,
 '@/lib/action-failure':`export const signInReturnHref=()=>'/sign-in';`,
 'next/link':`export default function Link(){}`,
 '@/ui':`export const Button=()=>null,Callout=Button,FieldRow=Button,Panel=Button,PanelHeader=Button,TextField=Button;`,
 './MatchList':`export const MatchList=()=>null,QueryReadback=MatchList;`,
 './PantryList':`export const PantryList=()=>null;`,
 './usePantry':`export const usePantry=()=>state.pantry,usePantrySearch=()=>({response:null,searching:false,error:null,search:()=>{}});`,
 './pantry.module.css':`export default {};`,
 './PantryReviewQueue':`export const PantryReviewQueue=()=>null;`,
 './BarcodeCapture':`export const BarcodeCapture=()=>null;`,
};
const shell=await build({bundle:true,write:false,format:'iife',globalName:'shell',jsx:'automatic',stdin:{resolveDir:process.cwd(),contents:"export {CookPanel} from './apps/web/modules/pantry/CookPanel.tsx';"},plugins:[{name:'cook-session-shell',setup(api){api.onResolve({filter:/.*/},args=>Object.hasOwn(shellMocks,args.path)?{path:args.path,namespace:'mock'}:undefined);api.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:shellMocks[args.path],loader:'js'}));}}]});
test('actual CookPanel: no-Clerk mode never calls useAuth and keeps local client',()=>{
 const state={authReads:0,configs:[]},ctx={state};runInNewContext(shell.outputFiles[0].text,ctx);const content=ctx.shell.CookPanel({clerkEnabled:false});assert.equal(content.props.api.local,true);assert.equal(state.authReads,0);assert.equal(state.configs.length,0);
});
test('actual CookPanel: authenticated/loading/signed-out mode always pins a session',()=>{
 const state={authReads:0,configs:[],auth:{userId:'synthetic-account',sessionId:'synthetic-session'}},ctx={state};runInNewContext(shell.outputFiles[0].text,ctx);
 const wrapper=ctx.shell.CookPanel({clerkEnabled:true});assert.equal(wrapper.type(wrapper.props).props.api.config.expectedSessionId,'synthetic-session');
 state.auth={userId:null,sessionId:null};assert.equal(wrapper.type(wrapper.props).props.api.config.expectedSessionId,'signed-out');
});

test('web pantry: older review load cannot restore an accepted grocery review',async()=>{
 const f=fixture(),initial=deferred();f.state.respond=async method=>method==='listPantryIntakes'?initial.promise:[];f.render();f.state.respond=async()=>({pantry:[{canonicalItem:'confirmed banana'}],intakes:[]});assert.equal(await f.render().resolveIntake('original-review','accept',['original-line']),true);initial.resolve([{id:'old-review'}]);await flush();assert.equal(f.render().intakes.length,0);assert.equal(f.render().items[0].canonicalItem,'confirmed banana');
});
test('web pantry: older pantry load cannot undo a confirmed write',async()=>{
 const f=fixture(),initial=deferred();f.state.respond=async method=>method==='listPantry'?initial.promise:[];f.render();f.state.respond=async()=>[{canonicalItem:'confirmed banana'}];assert.equal(await f.render().add('synthetic'),true);initial.resolve([]);await flush();assert.equal(f.render().items[0].canonicalItem,'confirmed banana');
});
test('web pantry: retry invalidates previous read before effect cleanup',async()=>{
 const f=fixture(),old=deferred();f.state.respond=method=>method==='listPantryIntakes'?old.promise:Promise.resolve([]);f.render();await flush();f.render().retryIntakes();const writes=f.state.writes;old.resolve([{id:'stale-review'}]);await flush();assert.equal(f.state.writes,writes);f.unmount();
});
test('web pantry: explicit reload reconciles lost review acknowledgement without replaying write',async()=>{
 const f=fixture();f.state.respond=async method=>method==='listPantryIntakes'?[{id:'original-review',digest:'original-digest'}]:[];f.render();await flush();let persisted=false;f.state.respond=async method=>{if(method==='resolvePantryIntake'){persisted=true;throw Error('lost acknowledgement');}return method==='listPantry'?[{canonicalItem:'confirmed banana'}]:[];};assert.equal(await f.render().resolveIntake('original-review','accept',['original-line']),false);assert.equal(persisted,true);f.render().retryPantry();f.render().retryIntakes();f.render();await flush();assert.equal(f.render().items[0].canonicalItem,'confirmed banana');assert.equal(f.render().intakes.length,0);assert.equal(f.state.calls.filter(x=>x.method==='resolvePantryIntake').length,1);
});


test('actual CookPanel: refresh is available without read errors and invokes reads only',()=>{
 const calls=[];const state={content:true,cursor:0,authReads:0,configs:[],pantry:{items:[],intakes:[],loaded:true,intakesLoaded:true,loading:false,intakesLoading:false,retryPantry:()=>calls.push('pantry-read'),retryIntakes:()=>calls.push('review-read')}};const ctx={state};runInNewContext(shell.outputFiles[0].text,ctx);
 const walk=n=>!n||typeof n!=='object'?[]:[n,...[n.props?.children].flat(Infinity).flatMap(walk)];
 const render=()=>{state.cursor=0;const content=ctx.shell.CookPanel({clerkEnabled:false});return walk(content.type(content.props));};
 const action=render().find(n=>n.props?.children==='Refresh pantry and grocery reviews');assert.ok(action);assert.equal(action.props.disabled,false);action.props.onClick();assert.deepEqual(calls,['pantry-read','review-read']);
 state.pantry.intakesLoading=true;assert.equal(render().find(n=>n.props?.children==='Refresh pantry and grocery reviews').props.disabled,true);
});
