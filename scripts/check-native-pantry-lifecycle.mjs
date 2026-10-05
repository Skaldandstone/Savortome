// Actual native usePantry hook; React/Clerk/client boundaries are synthetic.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';
const mocks={
 react:`export const useState=initial=>{const i=state.cursor++;if(!(i in state.values))state.values[i]=typeof initial==='function'?initial():initial;return[state.values[i],v=>{state.writes++;state.values[i]=typeof v==='function'?v(state.values[i]):v;}];};
 export const useRef=initial=>{const i=state.cursor++;return state.refs[i]??= {current:initial};};
 export const useMemo=(fn,deps)=>{const i=state.cursor++;if(!state.deps[i]||deps.some((v,n)=>v!==state.deps[i][n])){state.deps[i]=deps;state.memos[i]=fn();}return state.memos[i];};
 export const useCallback=(fn,deps)=>useMemo(()=>fn,deps);
 export const useEffect=(fn,deps)=>{const i=state.cursor++;if(!state.deps[i]||deps.some((v,n)=>v!==state.deps[i][n])){state.deps[i]=deps;state.effects.push(()=>{state.cleanups[i]?.();state.cleanups[i]=fn();});}};`,
 '@clerk/expo':'export const useAuth=()=>state.auth;',
 '@/lib/client':`export const createAccountClient=account=>Object.fromEntries(['listPantry','listPantryIntakes','addPantry','updatePantry','removePantry','clearPantry','scanPantryReceipt','resolvePantryIntake'].map(method=>[method,async(...args)=>{state.calls.push({account,method,args});return state.respond(method,...args);} ]));`,
};
const bundle=await build({bundle:true,write:false,format:'iife',globalName:'pantry',stdin:{resolveDir:process.cwd(),contents:"export {usePantry} from './apps/mobile/modules/pantry/usePantry.ts';"},plugins:[{name:'pantry-lifecycle',setup(api){api.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'mock'}:undefined);api.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js'}));}}]});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function fixture(){
 const state={cursor:0,values:[],refs:[],deps:[],memos:[],effects:[],cleanups:[],writes:0,calls:[],auth:{userId:'account-a',sessionId:'session-a'},respond:async()=>[]};
 const context={state};runInNewContext(bundle.outputFiles[0].text,context);
 const render=(commit=true)=>{state.cursor=0;const hook=context.pantry.usePantry();if(commit)state.effects.splice(0).forEach(fn=>fn());return hook;};
 const unmount=()=>state.cleanups.filter(Boolean).forEach(fn=>fn());
 return{state,render,unmount};
}
const late={pantry:[{canonicalItem:'synthetic-old-food'}],intakes:[{id:'synthetic-old-review'}]};
test('native pantry: old-account review and receipt results cannot repopulate another account',async()=>{
 for(const method of ['resolveIntake','scanReceipt']){const f=fixture();const old=f.render();await flush();const reply=deferred();f.state.respond=()=>reply.promise;
  const operation=method==='resolveIntake'?old.resolveIntake('old-review','accept',['item']):old.scanReceipt('synthetic','image/jpeg');
  f.state.respond=async()=>[];f.state.auth={userId:'account-b',sessionId:'session-b'};f.render();await flush();reply.resolve(method==='resolveIntake'?late:{intakes:late.intakes});assert.equal(await operation,false);
  const current=f.render();assert.deepEqual(Array.from(current.items),[]);assert.deepEqual(Array.from(current.intakes),[]);
 }
});
test('native pantry: old-account add completion and errors cannot replace current review',async()=>{
 for(const reject of [false,true]){const f=fixture(),old=f.render();await flush();const reply=deferred();f.state.respond=()=>reply.promise;const operation=old.add('synthetic');
  f.state.respond=async()=>[];f.state.auth={userId:'account-b',sessionId:'session-b'};f.render();await flush();reject?reply.reject(Error('old-account diagnostic')):reply.resolve(late.pantry);await operation;
  const current=f.render();assert.deepEqual(Array.from(current.items),[]);assert.equal(current.error,null);
 }
});
test('native pantry: same-account session replacement invalidates pending review result',async()=>{
 const f=fixture(),old=f.render();await flush();const reply=deferred();f.state.respond=()=>reply.promise;const operation=old.resolveIntake('old-review','accept',['item']);
 f.state.respond=async()=>[];f.state.auth={userId:'account-a',sessionId:'session-new'};f.render();await flush();reply.resolve(late);assert.equal(await operation,false);assert.deepEqual(Array.from(f.render().items),[]);
});
test('native pantry: retained handlers after unmount do not dispatch or mutate state',async()=>{
 const f=fixture(),old=f.render();await flush();f.unmount();const calls=f.state.calls.length,writes=f.state.writes;
 await old.add('synthetic');await old.update({canonicalItem:'synthetic'});await old.remove('synthetic');await old.clear();assert.equal(await old.scanReceipt('synthetic','image/jpeg'),false);assert.equal(await old.resolveIntake('old-review','dismiss'),false);old.queuedIntake({id:'synthetic'});
 assert.equal(f.state.calls.length,calls);assert.equal(f.state.writes,writes);
});
test('native pantry: retained queued review from previous account cannot enter current queue',async()=>{
 const f=fixture(),old=f.render();await flush();f.state.auth={userId:'account-b',sessionId:'session-b'};f.render();await flush();old.queuedIntake({id:'old-review'});assert.deepEqual(Array.from(f.render().intakes),[]);
});
test('native pantry: current review still updates pantry and returns confirmed success',async()=>{
 const f=fixture(),current=f.render();await flush();f.state.respond=async()=>late;assert.equal(await current.resolveIntake('review','accept',['item']),true);
 assert.equal(f.render().items[0].canonicalItem,'synthetic-old-food');assert.equal(f.render().intakes[0].id,'synthetic-old-review');
});
test('native pantry: retained receipt/review actions after account replacement never dispatch',async()=>{
 const f=fixture(),old=f.render();await flush();f.state.auth={userId:'account-b',sessionId:'session-b'};f.render();await flush();const calls=f.state.calls.length;
 assert.equal(await old.scanReceipt('synthetic','image/jpeg'),false);assert.equal(await old.resolveIntake('old-review','accept',['item']),false);await old.add('synthetic');assert.equal(f.state.calls.length,calls);
});
test('native pantry: old receipt/review rejection cannot display another account diagnostic',async()=>{
 for(const method of ['scanReceipt','resolveIntake']){const f=fixture(),old=f.render();await flush();const reply=deferred();f.state.respond=()=>reply.promise;const operation=method==='scanReceipt'?old.scanReceipt('synthetic','image/jpeg'):old.resolveIntake('old-review','accept',['item']);
  f.state.respond=async()=>[];f.state.auth={userId:'account-b',sessionId:'session-b'};f.render();await flush();reply.reject(Error('old-account diagnostic'));assert.equal(await operation,false);assert.equal(f.render().error,null);
 }
});
test('native pantry: already-dispatched receipt/review settling after unmount cannot update state',async()=>{
 for(const method of ['scanReceipt','resolveIntake']){const f=fixture(),old=f.render();await flush();const reply=deferred();f.state.respond=()=>reply.promise;const operation=method==='scanReceipt'?old.scanReceipt('synthetic','image/jpeg'):old.resolveIntake('old-review','accept',['item']);f.unmount();const writes=f.state.writes;
  reply.resolve(method==='scanReceipt'?{intakes:late.intakes}:late);assert.equal(await operation,false);assert.equal(f.state.writes,writes);
 }
});
test('native pantry: auth render invalidates an old initial load before effect cleanup',async()=>{
 const f=fixture(),reply=deferred();f.state.respond=()=>reply.promise;f.render();f.state.auth={userId:'account-b',sessionId:'session-b'};f.render(false);const writes=f.state.writes;
 reply.resolve(late.pantry);await flush();assert.equal(f.state.writes,writes);f.unmount();
});
test('native pantry: previous account data is hidden before new effect clears it',async()=>{
 const f=fixture(),old=f.render();await flush();f.state.respond=async()=>late;await old.resolveIntake('review','accept',['item']);assert.equal(f.render().items.length,1);
 f.state.auth={userId:'account-b',sessionId:'session-b'};const next=f.render(false);assert.deepEqual(Array.from(next.items),[]);assert.deepEqual(Array.from(next.intakes),[]);assert.equal(next.loading,true);assert.equal(next.error,null);f.unmount();
});
