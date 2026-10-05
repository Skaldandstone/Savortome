// Actual native pantry/search hooks; React/Clerk/client boundaries are synthetic.
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
 '@/lib/client':`export const createAccountClient=account=>Object.fromEntries(['listPantry','listPantryIntakes','addPantry','updatePantry','removePantry','clearPantry','scanPantryReceipt','resolvePantryIntake','searchPantry'].map(method=>[method,async(...args)=>{state.calls.push({account,method,args});return state.respond(method,...args);} ]));`,
};
const bundle=await build({bundle:true,write:false,format:'iife',globalName:'pantry',stdin:{resolveDir:process.cwd(),contents:"export {usePantry,usePantrySearch} from './apps/mobile/modules/pantry/usePantry.ts';"},plugins:[{name:'pantry-lifecycle',setup(api){api.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'mock'}:undefined);api.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js'}));}}]});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function fixture(hookName='usePantry'){
 const state={cursor:0,values:[],refs:[],deps:[],memos:[],effects:[],cleanups:[],writes:0,calls:[],auth:{userId:'account-a',sessionId:'session-a'},respond:async()=>[]};
 const context={state};runInNewContext(bundle.outputFiles[0].text,context);
 const render=(commit=true)=>{state.cursor=0;const hook=context.pantry[hookName]();if(commit)state.effects.splice(0).forEach(fn=>fn());return hook;};
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
test('native pantry search: retained unmounted action cannot dispatch or mutate state',async()=>{
 const f=fixture('usePantrySearch'),old=f.render();f.unmount();const calls=f.state.calls.length,writes=f.state.writes;await old.search('synthetic');assert.equal(f.state.calls.length,calls);assert.equal(f.state.writes,writes);
});
test('native pantry search: same-account session replacement invalidates pending result/error',async()=>{
 for(const reject of [false,true]){const f=fixture('usePantrySearch'),old=f.render(),reply=deferred();f.state.respond=()=>reply.promise;const operation=old.search('synthetic');f.state.auth={userId:'account-a',sessionId:'session-new'};f.render();reject?reply.reject(Error('old-session diagnostic')):reply.resolve({marker:'old-session result'});await operation;
  const current=f.render();assert.equal(current.response,null);assert.equal(current.error,null);assert.equal(current.searching,false);
 }
});
test('native pantry search: retained old-account action cannot replace current results',async()=>{
 const f=fixture('usePantrySearch'),old=f.render();f.state.auth={userId:'account-b',sessionId:'session-b'};const next=f.render();f.state.respond=async()=>({marker:'current result'});await next.search('current');const calls=f.state.calls.length;f.state.respond=async()=>({marker:'old result'});await old.search('old');assert.equal(f.state.calls.length,calls);assert.equal(f.render().response.marker,'current result');
});
test('native pantry search: old data hidden and pending result ignored before effect cleanup',async()=>{
 const f=fixture('usePantrySearch'),old=f.render();f.state.respond=async()=>({marker:'old result'});await old.search('synthetic');assert.equal(f.render().response.marker,'old result');const reply=deferred();f.state.respond=()=>reply.promise;const operation=old.search('pending');f.state.auth={userId:'account-b',sessionId:'session-b'};const next=f.render(false);assert.equal(next.response,null);assert.equal(next.error,null);const writes=f.state.writes;reply.resolve({marker:'late old result'});await operation;assert.equal(f.state.writes,writes);f.unmount();
});
test('native pantry search: newer same-account search still wins out-of-order completion',async()=>{
 const f=fixture('usePantrySearch'),current=f.render(),first=deferred(),second=deferred();f.state.respond=(_method,query)=>query==='first'?first.promise:second.promise;
 const old=current.search('first'),next=current.search('second');second.resolve({marker:'second'});await next;first.resolve({marker:'first'});await old;assert.equal(f.render().response.marker,'second');assert.equal(f.render().searching,false);
});

test('native reviews: lost receipt acknowledgement reconciles original review without another scan',async()=>{
 const f=fixture(),hook=f.render();await flush();const review={id:'receipt-original',digest:'original-digest',status:'pending',items:[{id:'line-original',name:'synthetic bananas',quantity:6}]};let persisted=[];
 f.state.respond=async(method)=>{if(method==='scanPantryReceipt'){persisted=[review];throw Error('acknowledgement lost');}if(method==='listPantryIntakes')return persisted;return [];};
 assert.equal(await hook.scanReceipt('synthetic','image/jpeg'),false);assert.equal(f.render().intakes.length,0);assert.equal(await f.render().refreshReviews(),true);
 assert.equal(f.render().intakes[0],review);assert.equal(f.render().items.length,0);assert.equal(f.state.calls.filter(x=>x.method==='scanPantryReceipt').length,1);assert.equal(f.state.calls.filter(x=>x.method==='resolvePantryIntake').length,0);
});
test('native reviews: failed refresh retains last confirmed reviews and stays uncertain',async()=>{
 const f=fixture();f.render();await flush();const review={id:'original'};f.render().queuedIntake(review);f.state.respond=async()=>{throw Error('synthetic offline');};assert.equal(await f.render().refreshReviews(),false);assert.equal(f.render().intakes[0],review);assert.match(f.render().error,/could not confirm/i);
});
test('native reviews: retained refresh cannot dispatch after unmount or auth replacement',async()=>{
 for(const replacement of ['unmount','account','session']){const f=fixture(),old=f.render();await flush();if(replacement==='unmount')f.unmount();else{f.state.auth={userId:replacement==='account'?'account-b':'account-a',sessionId:'new-session'};f.render(false);}const calls=f.state.calls.length;assert.equal(await old.refreshReviews(),false);assert.equal(f.state.calls.length,calls);}
});
test('native reviews: late refresh cannot overwrite newly queued review',async()=>{
 const f=fixture();f.render();await flush();const reply=deferred();f.state.respond=()=>reply.promise;const operation=f.render().refreshReviews();const review={id:'new-original'};f.render().queuedIntake(review);reply.resolve([]);assert.equal(await operation,false);assert.equal(f.render().intakes[0],review);assert.equal(f.render().refreshingReviews,false);
});
test('native reviews: same-frame refresh is single flight and old-session settlement is inert',async()=>{
 const f=fixture();f.render();await flush();const reply=deferred();f.state.respond=()=>reply.promise;const old=f.render(),operation=old.refreshReviews(),calls=f.state.calls.length;assert.equal(await old.refreshReviews(),false);assert.equal(f.state.calls.length,calls);f.state.auth={userId:'account-a',sessionId:'new-session'};f.state.respond=async()=>[];f.render();await flush();const writes=f.state.writes;reply.resolve([{id:'old-private'}]);assert.equal(await operation,false);assert.equal(f.state.writes,writes);assert.equal(f.render().intakes.length,0);
});

test('native reviews: old mount read cannot replace refreshed reviews or report old error',async()=>{
 for(const reject of [false,true]){const f=fixture(),initial=deferred();f.state.respond=()=>initial.promise;f.render();const original={id:'refreshed-original',digest:'unchanged'};f.state.respond=async method=>method==='listPantryIntakes'?[original]:[];assert.equal(await f.render().refreshReviews(),true);reject?initial.reject(Error('old diagnostic')):initial.resolve([]);await flush();assert.equal(f.render().intakes[0],original);assert.equal(f.render().error,null);}
});
test('native reviews: stale refresh cannot undo confirmed acceptance or restore an old review',async()=>{
 const f=fixture();f.render();await flush();const stale=deferred();f.state.respond=()=>stale.promise;const refresh=f.render().refreshReviews();f.state.respond=async()=>({pantry:[{canonicalItem:'confirmed bananas'}],intakes:[]});assert.equal(await f.render().resolveIntake('original-review','accept',['original-line']),true);stale.resolve([{id:'old-review'}]);assert.equal(await refresh,false);assert.equal(f.render().items[0].canonicalItem,'confirmed bananas');assert.equal(f.render().intakes.length,0);
});
