// Actual component, synthetic API/camera boundaries. Not device acceptance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
const mocks = {
  react: `export const useState=initial=>{const i=state.cursor++;if(!(i in state.values))state.values[i]=typeof initial==='function'?initial():initial;return[state.values[i],v=>{state.writes++;state.values[i]=typeof v==='function'?v(state.values[i]):v;}];};
 export const useRef=initial=>{const i=state.cursor++;return state.refs[i]??= {current:initial};};
 export const useMemo=(fn,deps)=>{const i=state.cursor++;if(!state.deps[i]||deps.some((v,n)=>v!==state.deps[i][n])){state.deps[i]=deps;state.memos[i]=fn();}return state.memos[i];};
 export const useCallback=(fn,deps)=>useMemo(()=>fn,deps);
 export const useEffect=(fn,deps)=>{const i=state.cursor++;if(!state.deps[i]||deps.some((v,n)=>v!==state.deps[i][n])){state.deps[i]=deps;state.effects.push(()=>{state.cleanups[i]?.();state.cleanups[i]=fn();});}};`,
  'react/jsx-runtime': `export const Fragment='Fragment';export const jsx=(type,props)=>({type,props});export const jsxs=jsx;`,
  'react-native': `export const View='View',Text='Text';export const StyleSheet={create:v=>v};`,
  '@clerk/expo': `export const useAuth=()=>state.auth;`,
  'expo-image-picker': `export const requestCameraPermissionsAsync=()=>state.permission();export const launchCameraAsync=()=>state.picker();export const launchImageLibraryAsync=()=>state.picker();`,
  '@seconds/core/format': `export const isPhotoMediaType=v=>['image/jpeg','image/png','image/webp'].includes(v);`,
  '@/lib/client': `export const api={receiptScanStatus:()=>new Promise((resolve,reject)=>state.requests.push({resolve,reject}))};`,
  '@/ui': `export const Button='Button',Callout='Callout',Panel='Panel',PanelHeader='PanelHeader';export const space={sm:8},type={small:14},usePalette=()=>({textMuted:'#c0af92'});`,
};
const bundle = await build({bundle:true,write:false,format:'iife',globalName:'app',jsx:'automatic',
  stdin:{resolveDir:process.cwd(),contents:`export {ReceiptCapture} from './apps/mobile/modules/pantry/ReceiptCapture.tsx';`},
  plugins:[{name:'receipt-boundaries',setup(api){
    api.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'mock'}:undefined);
    api.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js'}));
  }}]});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
  const state={cursor:0,values:[],refs:[],deps:[],memos:[],effects:[],cleanups:[],requests:[],timers:[],scans:[],writes:0,auth:{userId:"synthetic-account-a",sessionId:"synthetic-session-a"},
    permission:async()=>({granted:true}),picker:async()=>({canceled:false,assets:[{mimeType:'image/jpeg',base64:'synthetic'}]}),scan:async()=>true};
  const context={state,setTimeout:fn=>{state.timers.push(fn);return fn;},clearTimeout:fn=>state.timers=state.timers.filter(t=>t!==fn)};
  runInNewContext(bundle.outputFiles[0].text,context);
  const render=(commit=true)=>{state.cursor=0;const tree=context.app.ReceiptCapture({onScan:async(...args)=>{state.scans.push(args);return state.scan(...args);}});if(commit)state.effects.splice(0).forEach(fn=>fn());return tree;};
  return {state,render,unmount:()=>state.cleanups.filter(Boolean).forEach(fn=>fn())};
}
function nodes(tree){return Array.isArray(tree)?tree.flatMap(nodes):tree&&typeof tree==='object'?[tree,...nodes(tree.props?.children)]:[];}
function text(tree){if(Array.isArray(tree))return tree.map(text).join(' ');if(tree&&typeof tree==='object')return [tree.props?.title,tree.props?.hint,text(tree.props?.children)].filter(Boolean).join(' ');return String(tree??'');}
const button=(tree,label)=>nodes(tree).find(n=>n.type==='Button'&&n.props.label===label);
async function enabled(){const f=fixture();f.render();f.state.requests[0].resolve({enabled:true});await flush();return f;}
test('loading is visible and does not imply disabled',()=>{const tree=fixture().render();assert.match(text(tree),/Checking receipt scanning/);assert.equal(nodes(tree).filter(n=>n.type==='Button').length,0);});
test('failed capability check offers retry; successful retry enables capture',async()=>{const f=fixture();f.render();f.state.requests[0].reject(Error('private response'));await flush();let tree=f.render();assert.match(text(tree),/Could not check/);assert.doesNotMatch(text(tree),/private response|not enabled/);button(tree,'Try receipt scanning again').props.onPress();f.render();f.state.requests[1].resolve({enabled:true});await flush();assert.ok(button(f.render(),'Take receipt photo'));});
test('explicit server disable is distinct from failed loading',async()=>{const f=fixture();f.render();f.state.requests[0].resolve({enabled:false});await flush();assert.match(text(f.render()),/currently unavailable/);assert.equal(button(f.render(),'Try receipt scanning again'),undefined);});
test('stalled check times out; old response cannot replace retried result',async()=>{const f=fixture();f.render();f.state.timers[0]();button(f.render(),'Try receipt scanning again').props.onPress();f.render();f.state.requests[1].resolve({enabled:false});await flush();f.state.requests[0].resolve({enabled:true});await flush();assert.match(text(f.render()),/currently unavailable/);});
test('unmounted availability request cannot update state',async()=>{const f=fixture();f.render();f.state.cleanups.filter(Boolean).forEach(fn=>fn());f.state.requests[0].resolve({enabled:true});await flush();assert.equal(f.state.values[0],'loading');assert.equal(f.state.timers.length,0);});
test('camera permission rejection recovers buttons and keeps photo alternative',async()=>{const f=await enabled();f.state.permission=async()=>{throw Error('private native error');};await button(f.render(),'Take receipt photo').props.onPress();await flush();const tree=f.render();assert.match(text(tree),/could not be read/);assert.doesNotMatch(text(tree),/private native error/);assert.equal(button(tree,'Choose receipt photo').props.disabled,false);assert.equal(f.state.scans.length,0);});
test('camera denial never uploads and explains alternative',async()=>{const f=await enabled();f.state.permission=async()=>({granted:false});await button(f.render(),'Take receipt photo').props.onPress();await flush();assert.match(text(f.render()),/choose an existing/);assert.equal(f.state.scans.length,0);});
test('cancelled picker returns quietly with no upload',async()=>{const f=await enabled();f.state.picker=async()=>({canceled:true});await button(f.render(),'Choose receipt photo').props.onPress();await flush();assert.equal(f.state.scans.length,0);assert.equal(nodes(f.render()).filter(n=>n.type==='Callout').length,0);});
test('unsupported image never uploads',async()=>{const f=await enabled();f.state.picker=async()=>({canceled:false,assets:[{mimeType:'image/heic',base64:'synthetic',uri:'receipt.heic'}]});await button(f.render(),'Choose receipt photo').props.onPress();await flush();assert.match(text(f.render()),/JPEG, PNG, or WebP/);assert.equal(f.state.scans.length,0);});
test('rejected write is not reported as a saved review',async()=>{const f=await enabled();f.state.scan=async()=>false;await button(f.render(),'Choose receipt photo').props.onPress();await flush();assert.match(text(f.render()),/could not confirm.*review saved/);assert.doesNotMatch(text(f.render()),/Receipt ready/);});
test('successful upload is review only, not pantry inventory',async()=>{const f=await enabled();await button(f.render(),'Choose receipt photo').props.onPress();await flush();assert.match(text(f.render()),/Nothing was added to your pantry yet/);assert.equal(f.state.scans.length,1);});
test('both actions stay disabled while permission is pending',async()=>{const f=await enabled();let finish;f.state.permission=()=>new Promise(resolve=>finish=resolve);button(f.render(),'Take receipt photo').props.onPress();assert.ok(nodes(f.render()).filter(n=>n.type==='Button').every(n=>n.props.disabled));finish({granted:false});await flush();assert.equal(button(f.render(),'Choose receipt photo').props.disabled,false);});
test('throwing scan recovers without exposing provider details or claiming success',async()=>{const f=await enabled();f.state.scan=async()=>{throw Error('private provider details');};button(f.render(),'Choose receipt photo').props.onPress();await flush();assert.match(text(f.render()),/could not confirm.*review saved/);assert.doesNotMatch(text(f.render()),/private provider details|Receipt ready/);assert.equal(button(f.render(),'Choose receipt photo').props.disabled,false);});

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
test('receipt: retained unmounted actions cannot launch picker or ask permission',async()=>{
 const f=await enabled(),old=f.render();let picks=0,permissions=0;f.state.picker=async()=>{picks++;return{canceled:true};};f.state.permission=async()=>{permissions++;return{granted:true};};f.unmount();const writes=f.state.writes;button(old,'Take receipt photo').props.onPress();button(old,'Choose receipt photo').props.onPress();await flush();assert.equal(picks,0);assert.equal(permissions,0);assert.equal(f.state.writes,writes);
});
test('receipt: pending permission after unmount cannot launch camera',async()=>{
 const f=await enabled(),permission=deferred();let picks=0;f.state.permission=()=>permission.promise;f.state.picker=async()=>{picks++;return{canceled:true};};button(f.render(),'Take receipt photo').props.onPress();f.unmount();const writes=f.state.writes;permission.resolve({granted:true});await flush();assert.equal(picks,0);assert.equal(f.state.writes,writes);
});
test('receipt: old picker after session replacement cannot upload or display feedback',async()=>{
 const f=await enabled(),picker=deferred();f.state.picker=()=>picker.promise;button(f.render(),'Choose receipt photo').props.onPress();f.state.auth.sessionId='synthetic-session-b';f.render(false);const writes=f.state.writes;picker.resolve({canceled:false,assets:[{mimeType:'image/jpeg',base64:'synthetic'}]});await flush();assert.equal(f.state.scans.length,0);assert.equal(f.state.writes,writes);f.unmount();
});
test('receipt: old upload completion cannot claim success after session replacement',async()=>{
 const f=await enabled(),reply=deferred();f.state.scan=()=>reply.promise;button(f.render(),'Choose receipt photo').props.onPress();await flush();f.state.auth.sessionId='synthetic-session-b';f.render(false);const writes=f.state.writes;reply.resolve(true);await flush();assert.equal(f.state.writes,writes);f.unmount();
});
test('receipt: same-frame repeated capture does not launch multiple pickers',async()=>{
 const f=await enabled(),picker=deferred();let picks=0;f.state.picker=()=>{picks++;return picker.promise;};const old=f.render();button(old,'Choose receipt photo').props.onPress();button(old,'Choose receipt photo').props.onPress();assert.equal(picks,1);picker.resolve({canceled:true});await flush();
});

test('receipt: old availability response cannot publish before account cleanup',async()=>{
 const f=fixture();f.render();f.state.auth={userId:'synthetic-account-b',sessionId:'synthetic-session-b'};f.render(false);const writes=f.state.writes;f.state.requests[0].resolve({enabled:true});await flush();assert.equal(f.state.writes,writes);f.unmount();
});
test('receipt: retained previous-session capture cannot dispatch after replacement',async()=>{
 const f=await enabled(),old=f.render();let picks=0;f.state.picker=async()=>{picks++;return{canceled:true};};f.state.auth.sessionId='synthetic-session-b';f.render();f.state.requests[1].resolve({enabled:true});await flush();const writes=f.state.writes;button(old,'Choose receipt photo').props.onPress();await flush();assert.equal(picks,0);assert.equal(f.state.writes,writes);
});
test('receipt: old permission or upload rejection after unmount cannot leak feedback',async()=>{
 for(const stage of ['permission','upload']){const f=await enabled(),reply=deferred();if(stage==='permission')f.state.permission=()=>reply.promise;else f.state.scan=()=>reply.promise;button(f.render(),stage==='permission'?'Take receipt photo':'Choose receipt photo').props.onPress();await flush();f.unmount();const writes=f.state.writes;reply.reject(Error('old private diagnostic'));await flush();assert.equal(f.state.writes,writes);}
});

test('receipt: a persisted review with lost acknowledgement is never called not saved',async()=>{
 const f=await enabled();let persisted=false;f.state.scan=async()=>{persisted=true;return false;};button(f.render(),'Choose receipt photo').props.onPress();await flush();assert.equal(persisted,true);const copy=text(f.render());assert.match(copy,/could not confirm.*review saved/);assert.match(copy,/Check.*reviews.*before/i);assert.doesNotMatch(copy,/not saved for review|Receipt ready/);
});
test('receipt: thrown response loss after simulated persistence communicates uncertainty',async()=>{
 const f=await enabled();let persisted=false;f.state.scan=async()=>{persisted=true;throw Error('synthetic acknowledgement lost');};button(f.render(),'Choose receipt photo').props.onPress();await flush();assert.equal(persisted,true);assert.match(text(f.render()),/could not confirm.*review saved/);assert.doesNotMatch(text(f.render()),/could not be read|synthetic acknowledgement lost|Receipt ready/);
});
