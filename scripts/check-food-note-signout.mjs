// Actual sign-out component and recovery store; auth/Alert/SecureStore boundaries synthetic.
// No real account sign-out/deletion, provider, device or encryption acceptance.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';
const mocks={
 react:`export const useState=v=>{const i=state.cursor++;if(!(i in state.values))state.values[i]=v;return[state.values[i],v=>state.values[i]=v];};export const useRef=v=>state.values[state.cursor++]??={current:v};export const useEffect=(fn,deps)=>{const i=state.cursor++;if(!state.deps[i]||deps.some((v,n)=>v!==state.deps[i][n])){state.cleanup[i]?.();state.deps[i]=deps;state.effects.push(()=>state.cleanup[i]=fn());}};`,
 'react/jsx-runtime':`export const jsx=(type,props)=>({type,props});export const jsxs=jsx;`,
 'react-native':`export const View='View';export const Alert={alert:(title,message,buttons,options)=>state.alerts.push({title,message,buttons,options})};`,
 '@clerk/expo':`export const useAuth=()=>({userId:state.userId,sessionId:state.sessionId,signOut:()=>state.signOut()});export const getClerkInstance=()=>({get session(){return state.sdkSession;}});`,
 '@/ui':`export const Button='Button',Callout='Callout';`,
 '@seconds/core/format':`export {foodLogId,parseFoodLogInput} from './packages/core/src/food-log.ts';`,
 '@/lib/nativeFoodNoteRecovery':`import {createFoodNoteRecoveryStore} from './apps/mobile/lib/foodNoteRecovery.ts';export const createNativeFoodNoteRecovery=(accountId,sessionId)=>createFoodNoteRecoveryStore({accountId,sessionId,environment:state.environment,currentSession:()=>state.sdkSession?{accountId:state.sdkSession.user.id,sessionId:state.sdkSession.id}:null,digest:state.digest,storage:{get:async()=>null,set:async()=>{},remove:key=>state.remove(key)}});`,
};
const bundle=await build({entryPoints:['apps/mobile/modules/account/SignOutButton.tsx'],bundle:true,write:false,format:'iife',globalName:'app',jsx:'automatic',plugins:[{name:'local-auth-boundaries',setup(api){api.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'mock'}:undefined);api.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js',resolveDir:process.cwd()}));}}]});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function nodes(tree){return Array.isArray(tree)?tree.flatMap(nodes):tree&&typeof tree==='object'?[tree,...nodes(tree.props?.children)]:[];}
function fixture(){
 const state={cursor:0,values:[],deps:[],cleanup:[],effects:[],userId:'synthetic-account',sessionId:'synthetic-session',sdkSession:{id:'synthetic-session',user:{id:'synthetic-account'}},environment:`synthetic-signout-${++fixture.counter}`,alerts:[],calls:[],copy:true,timers:new Map(),nextTimer:0};
 state.digest=async value=>createHash('sha256').update(value).digest('hex');
 state.remove=async key=>{state.calls.push(['remove',key]);state.copy=false;};
 state.signOut=async()=>{state.calls.push(['signOut']);};
 const context={state,setTimeout:(fn,ms)=>{const key=++state.nextTimer;state.timers.set(key,{fn,ms});return key;},clearTimeout:key=>state.timers.delete(key)};runInNewContext(bundle.outputFiles[0].text,context);
 const render=()=>{state.cursor=0;const tree=context.app.SignOutButton();state.effects.splice(0).forEach(fn=>fn());return tree;};
 const button=()=>nodes(render()).find(n=>n.type==='Button');
 const press=()=>{assert.equal(button().props.disabled,false);button().props.onPress();};
 const choose=index=>{const alert=state.alerts.shift();assert.ok(alert);alert.buttons[index].onPress();return alert;};
 const settle=async()=>{for(let i=0;i<3;i++){render();await flush();}return render();};
 const message=()=>nodes(render()).filter(n=>n.type==='Callout').map(n=>n.props.children).join(' ');
 const expire=()=>{const [key,timer]=state.timers.entries().next().value;assert.equal(timer.ms,12000);state.timers.delete(key);timer.fn();};
 render();return{state,render,button,press,choose,settle,message,expire,unmount:()=>state.cleanup.filter(Boolean).forEach(fn=>fn())};
}
fixture.counter=0;
test('cancelled/dismissed prompt neither discards nor signs out',async()=>{const f=fixture();f.press();const alert=f.choose(0);alert.options.onDismiss();await f.settle();assert.equal(f.state.calls.length,0);f.press();f.state.alerts.shift().options.onDismiss();f.press();assert.equal(f.state.alerts.length,1);});
test('explicit sign-out without clearing preserves copy and makes no storage call',async()=>{const f=fixture();f.press();const alert=f.choose(1);assert.match(alert.message,/current app environment/);await f.settle();assert.deepEqual(f.state.calls,[['signOut']]);assert.equal(f.state.copy,true);});
test('confirmed discard completes before sign-out and uses opaque scope',async()=>{const f=fixture();f.press();f.choose(2);await f.settle();assert.deepEqual(f.state.calls.map(call=>call[0]),['remove','signOut']);assert.doesNotMatch(f.state.calls[0][1],/synthetic-account|synthetic-session/);assert.equal(f.state.copy,false);assert.equal(f.message(),'');});
test('failed discard blocks sign-out, preserves copy and hides platform details',async()=>{const f=fixture();f.state.remove=async()=>{throw Error('private device path');};f.press();f.choose(2);await f.settle();assert.equal(f.state.calls.length,0);assert.equal(f.state.copy,true);assert.match(f.message(),/Sign-out was not started/);assert.doesNotMatch(f.message(),/private device path/);f.press();f.choose(1);await f.settle();assert.deepEqual(f.state.calls,[['signOut']]);});
test('timed-out discard cannot sign out later, even when native removal finishes',async()=>{const f=fixture();const gate=deferred();const original=f.state.remove;f.state.remove=async(...args)=>{await gate.promise;await original(...args);};f.press();f.choose(2);await flush();f.expire();await f.settle();assert.match(f.message(),/may still finish/);assert.equal(f.state.copy,true);gate.resolve();await f.settle();assert.equal(f.state.copy,false);assert.equal(f.state.calls.some(call=>call[0]==='signOut'),false);assert.equal(f.state.timers.size,0);});
test('account change while alert is open cannot sign replacement account out',async()=>{const f=fixture();f.press();f.state.userId='other-account';f.state.sessionId='other-session';f.state.sdkSession={id:'other-session',user:{id:'other-account'}};f.render();f.choose(1);await f.settle();assert.equal(f.state.calls.length,0);});
test('authoritative SDK session change blocks sign-out even before hook rerender',async()=>{const f=fixture();f.press();f.state.sdkSession={id:'replacement-session',user:{id:'synthetic-account'}};f.choose(1);await f.settle();assert.equal(f.state.calls.length,0);});
test('same-account session replacement during pending discard prevents old sign-out',async()=>{const f=fixture();const gate=deferred();f.state.remove=()=>gate.promise;f.press();f.choose(2);await flush();f.state.sessionId='replacement-session';f.state.sdkSession={id:'replacement-session',user:{id:'synthetic-account'}};await f.settle();gate.resolve();await f.settle();assert.equal(f.state.calls.length,0);assert.equal(f.button().props.disabled,false);});
test('duplicate presses and alert dismissal cannot release an in-flight discard',async()=>{const f=fixture();const gate=deferred();f.state.remove=()=>gate.promise;f.press();f.press();assert.equal(f.state.alerts.length,1);const alert=f.choose(2);alert.options.onDismiss();alert.buttons[1].onPress();await flush();assert.equal(f.button().props.disabled,true);assert.equal(f.button().props.busy,true);assert.equal(f.state.calls.length,0);gate.resolve();await f.settle();assert.deepEqual(f.state.calls,[['signOut']]);});
test('unmount while discard is pending suppresses sign-out and feedback',async()=>{const f=fixture();const gate=deferred();f.state.remove=()=>gate.promise;f.press();f.choose(2);await flush();f.unmount();gate.resolve();await flush();assert.equal(f.state.calls.length,0);assert.equal(f.message(),'');});
test('sign-out rejection does not recreate a discarded copy or expose auth details',async()=>{const f=fixture();f.state.signOut=async()=>{throw Error('private auth response');};f.press();f.choose(2);await f.settle();assert.equal(f.state.copy,false);assert.match(f.message(),/Sign-out was not confirmed/);assert.doesNotMatch(f.message(),/private auth response/);assert.equal(f.button().props.disabled,false);});
test('missing account/session disables sign-out rather than discarding an unknown scope',async()=>{const f=fixture();f.state.userId=null;f.state.sessionId=null;f.state.sdkSession=null;await f.settle();assert.equal(f.button().props.disabled,true);f.button().props.onPress();assert.equal(f.state.alerts.length,0);assert.equal(f.state.calls.length,0);});
