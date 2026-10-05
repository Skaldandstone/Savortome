// Actual native barcode component; synthetic React/Clerk/camera/client, no device.
import {test} from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {runInNewContext} from 'node:vm';
const mocks={react:`export const useState=initial=>{const i=state.cursor++;if(!(i in state.values))state.values[i]=typeof initial==='function'?initial():initial;return[state.values[i],v=>{state.writes++;state.values[i]=typeof v==='function'?v(state.values[i]):v;}];};
 export const useRef=initial=>{const i=state.cursor++;return state.refs[i]??= {current:initial};};
 export const useMemo=(fn,deps)=>{const i=state.cursor++;if(!state.deps[i]||deps.some((v,n)=>v!==state.deps[i][n])){state.deps[i]=deps;state.memos[i]=fn();}return state.memos[i];};
 export const useCallback=(fn,deps)=>useMemo(()=>fn,deps);
 export const useEffect=(fn,deps)=>{const i=state.cursor++;if(!state.deps[i]||deps.some((v,n)=>v!==state.deps[i][n])){state.deps[i]=deps;state.effects.push(()=>{state.cleanups[i]?.();state.cleanups[i]=fn();});}};`,
 'react/jsx-runtime':`export const jsx=(type,props)=>({type,props});export const jsxs=jsx;`,
 'react-native':`export const View='View',Text='Text',StyleSheet={create:v=>v},Alert={alert:(...args)=>state.alerts.push(args)},Linking={openURL:async()=>{}};export const AppState={get currentState(){return state.appState;},addEventListener:(_event,fn)=>{state.appListener=fn;return{remove:()=>state.appListener=null};}};`,
 'expo-camera':`export const CameraView='CameraView',useCameraPermissions=()=>[{granted:false},()=>{state.permissions++;return state.permission();}];`,
 'expo-router':`import {useEffect} from 'react';export const useFocusEffect=fn=>useEffect(()=>{const cleanup=fn();state.focusCleanups.push(cleanup);return cleanup;},[fn]);`,
 '@clerk/expo':`export const useAuth=()=>state.auth;`,
 'expo-crypto':`export const randomUUID=()=>'synthetic-reference';`,
 '@seconds/core/format':`export const parseProductBarcode=code=>code;`,
 '@/lib/client':`export const createAccountClient=account=>Object.fromEntries(['barcodeLookupStatus','lookupProductBarcode','createPantryIntake'].map(method=>[method,async(...args)=>{state.calls.push({account,method,args});return state.respond(method,...args);} ]));`,
 '@/ui':`export const Button='Button',Callout='Callout',Field='Field',Panel='Panel',PanelHeader='PanelHeader',space={sm:8},usePalette=()=>({text:'#eee',textMuted:'#bbb'});`,
};
const bundle=await build({bundle:true,write:false,format:'iife',globalName:'app',jsx:'automatic',stdin:{resolveDir:process.cwd(),contents:"export {BarcodeCapture} from './apps/mobile/modules/pantry/BarcodeCapture.tsx';"},plugins:[{name:'native-barcode-boundaries',setup(api){api.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'mock'}:undefined);api.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js'}));}}]});
const flush=()=>new Promise(resolve=>setImmediate(resolve));const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function nodes(tree){return Array.isArray(tree)?tree.flatMap(nodes):tree&&typeof tree==='object'?[tree,...nodes(tree.props?.children)]:[];}
function text(tree){return Array.isArray(tree)?tree.map(text).join(' '):tree&&typeof tree==='object'?text(tree.props?.children):String(tree??'');}
const button=(tree,label)=>nodes(tree).find(n=>n.type==='Button'&&n.props.label===label);const press=(tree,label)=>button(tree,label).props.onPress();
function fixture(){
 const state={cursor:0,values:[],refs:[],deps:[],memos:[],effects:[],cleanups:[],focusCleanups:[],writes:0,calls:[],queued:0,permissions:0,alerts:[],appState:'active',auth:{userId:'synthetic-account-a',sessionId:'synthetic-session-a'},respond:async method=>method==='barcodeLookupStatus'?{enabled:true}:method==='lookupProductBarcode'?{product:null}:{id:'synthetic-intake'},permission:async()=>({granted:true}),timers:new Map(),nextTimer:0};
 const ctx={state,setTimeout:(fn,ms)=>{const id=++state.nextTimer;state.timers.set(id,{fn,ms});return id;},clearTimeout:id=>state.timers.delete(id)};runInNewContext(bundle.outputFiles[0].text,ctx);
 const render=(commit=true)=>{state.cursor=0;const tree=ctx.app.BarcodeCapture({onQueued:()=>state.queued++});if(commit)state.effects.splice(0).forEach(fn=>fn());return tree;};
 const enter=()=>nodes(render()).find(n=>n.props?.accessibilityLabel==='Product name, editable').props.onChangeText('Synthetic beans');
 return{state,render,enter,unmount:()=>state.cleanups.filter(Boolean).forEach(fn=>fn()),blur:()=>state.focusCleanups.filter(Boolean).forEach(fn=>fn())};
}
test('native barcode: retained unmounted queue/lookup/permission handlers cannot dispatch',async()=>{
 const f=fixture();f.render();await flush();f.enter();const old=f.render();f.unmount();const calls=f.state.calls.length,writes=f.state.writes;press(old,'Queue item for pantry review');press(old,'Look up label');press(old,'Scan barcode');await flush();assert.equal(f.state.calls.length,calls);assert.equal(f.state.permissions,0);assert.equal(f.state.writes,writes);
});
test('native barcode: same-user session replacement before cleanup suppresses pending queue',async()=>{
 const f=fixture();f.render();await flush();f.enter();const reply=deferred();f.state.respond=()=>reply.promise;press(f.render(),'Queue item for pantry review');f.state.auth.sessionId='synthetic-session-b';f.render(false);const writes=f.state.writes;reply.resolve({id:'synthetic-intake'});await flush();assert.equal(f.state.queued,0);assert.equal(f.state.writes,writes);f.unmount();
});
test('native barcode: retained old-account queue cannot dispatch after replacement',async()=>{
 const f=fixture();f.render();await flush();f.enter();const old=f.render();f.state.auth={userId:'synthetic-account-b',sessionId:'synthetic-session-b'};f.render();await flush();const calls=f.state.calls.length;press(old,'Queue item for pantry review');await flush();assert.equal(f.state.calls.length,calls);
});
test('native barcode: old mounted camera events cannot restore data after unmount',async()=>{
 const f=fixture();f.render();await flush();press(f.render(),'Scan barcode');await flush();const camera=nodes(f.render()).find(n=>n.type==='CameraView');f.unmount();const writes=f.state.writes;camera.props.onBarcodeScanned({type:'ean13',data:'synthetic-code'});camera.props.onMountError();assert.equal(f.state.writes,writes);
});
test('native barcode: blurred retained camera action cannot ask for permission',async()=>{
 const f=fixture();f.render();await flush();const old=f.render();f.blur();const writes=f.state.writes;press(old,'Scan barcode');await flush();assert.equal(f.state.permissions,0);assert.equal(f.state.writes,writes);
});
test('native barcode: old camera events cannot interfere with a reopened camera',async()=>{
 const f=fixture();f.render();await flush();press(f.render(),'Scan barcode');await flush();const oldTree=f.render(),camera=nodes(oldTree).find(n=>n.type==='CameraView');press(oldTree,'Close camera');press(f.render(),'Scan barcode');await flush();f.render();const writes=f.state.writes;camera.props.onBarcodeScanned({type:'ean13',data:'old-code'});camera.props.onMountError();assert.equal(f.state.writes,writes);
});
test('native barcode: failed queue retry preserves exact payload and review-only success',async()=>{
 const f=fixture();f.render();await flush();f.enter();let reject=true;f.state.respond=async()=>{if(reject)throw Error('private diagnostic');return{id:'synthetic-intake'};};press(f.render(),'Queue item for pantry review');await flush();assert.match(text(f.render()),/kept unchanged/);assert.doesNotMatch(text(f.render()),/private diagnostic/);reject=false;press(f.render(),'Retry the same pantry review');await flush();const writes=f.state.calls.filter(c=>c.method==='createPantryIntake');assert.deepEqual(writes[0].args,writes[1].args);assert.equal(f.state.queued,1);assert.match(text(f.render()),/Nothing has entered your pantry yet/);
});

test('native barcode: old availability and lookup cannot update after same-user session render',async()=>{
 for(const method of ['barcodeLookupStatus','lookupProductBarcode']){const f=fixture(),reply=deferred();if(method==='barcodeLookupStatus')f.state.respond=()=>reply.promise;f.render();await flush();if(method==='lookupProductBarcode'){f.state.respond=()=>reply.promise;press(f.render(),'Look up label');}f.state.auth.sessionId='synthetic-session-b';f.render(false);const writes=f.state.writes;reply.resolve(method==='barcodeLookupStatus'?{enabled:true}:{product:{displayName:'old private label'}});await flush();assert.equal(f.state.writes,writes);f.unmount();}
});
test('native barcode: pending permission after blur or session change cannot open camera',async()=>{
 for(const boundary of ['blur','session','background']){const f=fixture(),permission=deferred();f.state.permission=()=>permission.promise;f.render();await flush();press(f.render(),'Scan barcode');if(boundary==='blur')f.blur();else if(boundary==='session'){f.state.auth.sessionId='synthetic-session-b';f.render(false);}else{f.state.appState='background';f.state.appListener('background');}const writes=f.state.writes;permission.resolve({granted:true});await flush();assert.equal(f.state.writes,writes);f.unmount();}
});
test('native barcode: delayed discard confirmation cannot erase a replacement account entry',async()=>{
 const f=fixture();f.render();await flush();f.enter();f.state.respond=async()=>{throw Error('synthetic failure');};press(f.render(),'Queue item for pantry review');await flush();press(f.render(),'Discard local entry');const discard=f.state.alerts[0][2][1].onPress;f.state.respond=async()=>({enabled:true});f.state.auth={userId:'synthetic-account-b',sessionId:'synthetic-session-b'};f.render();await flush();f.enter();const writes=f.state.writes;discard();assert.equal(f.state.writes,writes);assert.equal(nodes(f.render()).find(n=>n.props?.accessibilityLabel==='Product name, editable').props.value,'Synthetic beans');
});
test('native barcode: prior entry is hidden before scope cleanup and retained edits ignored',async()=>{
 const f=fixture();f.render();await flush();f.enter();const field=nodes(f.render()).find(n=>n.props?.accessibilityLabel==='Product name, editable');f.state.auth.sessionId='synthetic-session-b';const next=f.render(false);assert.equal(nodes(next).some(n=>n.props?.value==='Synthetic beans'),false);const writes=f.state.writes;field.props.onChangeText('old edit');assert.equal(f.state.writes,writes);f.unmount();
});
test('native barcode: current local code closes scanner without automatic product lookup',async()=>{
 const f=fixture();f.render();await flush();press(f.render(),'Scan barcode');await flush();const camera=nodes(f.render()).find(n=>n.type==='CameraView');camera.props.onBarcodeScanned({type:'ean13',data:'synthetic-code'});const field=nodes(f.render()).find(n=>n.props?.accessibilityLabel==='Product barcode');assert.equal(field.props.value,'synthetic-code');assert.equal(f.state.calls.filter(c=>c.method==='lookupProductBarcode'||c.method==='createPantryIntake').length,0);assert.equal(nodes(f.render()).some(n=>n.type==='CameraView'),false);
});

test('native barcode: late mount error or timer cannot replace a code already found',async()=>{
 const f=fixture();f.render();await flush();press(f.render(),'Scan barcode');await flush();const tree=f.render(),camera=nodes(tree).find(n=>n.type==='CameraView'),timer=[...f.state.timers.values()].find(t=>t.ms===45000);camera.props.onBarcodeScanned({type:'ean13',data:'synthetic-code'});const writes=f.state.writes;camera.props.onMountError();timer.fn();assert.equal(f.state.writes,writes);assert.match(text(f.render()),/Barcode found/);
});
