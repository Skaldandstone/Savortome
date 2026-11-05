// Actual browser scanner lifecycle; synthetic media, detector, DOM, timers and React.
import {test} from 'node:test';import assert from 'node:assert/strict';import {build} from 'esbuild';import {runInNewContext} from 'node:vm';
const mocks={react:`export const useState=initial=>{const i=state.cursor++;if(!(i in state.values))state.values[i]=typeof initial==='function'?initial():initial;return[state.values[i],v=>{state.writes++;state.values[i]=typeof v==='function'?v(state.values[i]):v;}];};
 export const useRef=initial=>{const i=state.cursor++;return state.refs[i]??= {current:initial};};
 export const useMemo=(fn,deps)=>{const i=state.cursor++;if(!state.deps[i]||deps.some((v,n)=>v!==state.deps[i][n])){state.deps[i]=deps;state.memos[i]=fn();}return state.memos[i];};
 export const useCallback=(fn,deps)=>useMemo(()=>fn,deps);
 export const useEffect=(fn,deps)=>{const i=state.cursor++;if(!state.deps[i]||deps.some((v,n)=>v!==state.deps[i][n])){state.deps[i]=deps;state.effects.push(()=>{state.cleanups[i]?.();state.cleanups[i]=fn();});}};`,
 'react/jsx-runtime':`export const jsx=(type,props)=>{if(type==='video')props.ref.current=state.video;return{type,props};};export const jsxs=jsx;`,
 '@seconds/core/format':`export const parseProductBarcode=code=>{if(code==='invalid')throw Error('invalid');return code;};`,
 '@/ui':`export const Button='Button',Callout='Callout';`, './barcode.module.css':`export default {};`,
};
const bundle=await build({bundle:true,write:false,format:'iife',globalName:'app',jsx:'automatic',stdin:{resolveDir:process.cwd(),contents:"export {BrowserBarcodeScanner} from './apps/web/modules/pantry/BrowserBarcodeScanner.tsx';"},plugins:[{name:'scanner-boundaries',setup(api){api.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'mock'}:undefined);api.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js'}));}}]});
const flush=()=>new Promise(resolve=>setImmediate(resolve));const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function nodes(tree){return Array.isArray(tree)?tree.flatMap(nodes):tree&&typeof tree==='object'?[tree,...nodes(tree.props?.children)]:[];}
function fixture(){
 const state={cursor:0,values:[],refs:[],deps:[],memos:[],effects:[],cleanups:[],writes:0,stops:0,closed:0,codes:[],requests:[],timers:new Map(),nextTimer:0,formats:async()=>['ean_13'],media:async()=>state.stream,detect:async()=>[],video:{readyState:2,srcObject:null,play:async()=>{}}};
 state.stream={getTracks:()=>[{stop:()=>state.stops++}]};const documentListeners=new Map(),windowListeners=new Map();
 const document={hidden:false,addEventListener:(name,fn)=>documentListeners.set(name,fn),removeEventListener:name=>documentListeners.delete(name)};
 const window={isSecureContext:true,BarcodeDetector:class{static getSupportedFormats(){return state.formats();}detect(){return state.detect();}},addEventListener:(name,fn)=>windowListeners.set(name,fn),removeEventListener:name=>windowListeners.delete(name)};
 const ctx={state,document,window,navigator:{mediaDevices:{getUserMedia:async options=>{state.requests.push(options);return state.media();}}},setTimeout:(fn,ms)=>{const id=++state.nextTimer;state.timers.set(id,{fn,ms});return id;},clearTimeout:id=>state.timers.delete(id)};runInNewContext(bundle.outputFiles[0].text,ctx);
 const render=()=>{state.cursor=0;const tree=ctx.app.BrowserBarcodeScanner({onCode:code=>{assert.ok(state.stops>0);state.codes.push(code);},onClose:()=>state.closed++});state.effects.splice(0).forEach(fn=>fn());return tree;};
 const close=tree=>nodes(tree).find(n=>n.type==='Button').props.onClick();const unmount=()=>state.cleanups.filter(Boolean).forEach(fn=>fn());
 return{state,document,render,close,unmount,hide:()=>{document.hidden=true;documentListeners.get('visibilitychange')?.();},leave:()=>windowListeners.get('pagehide')?.(),deadline:()=>[...state.timers.values()].find(t=>t.ms===45000)?.fn()};
}
test('scanner: manual close stops camera synchronously without waiting for parent unmount',async()=>{
 const f=fixture(),tree=f.render();await flush();assert.equal(f.state.stops,0);f.close(tree);assert.equal(f.state.stops,1);assert.equal(f.state.video.srcObject,null);assert.equal(f.state.timers.size,0);assert.equal(f.state.closed,1);
});
test('scanner: manual close while permission pending stops late grant without attaching video',async()=>{
 const f=fixture(),grant=deferred();f.state.media=()=>grant.promise;const tree=f.render();await flush();f.close(tree);const writes=f.state.writes;grant.resolve(f.state.stream);await flush();assert.equal(f.state.stops,1);assert.equal(f.state.video.srcObject,null);assert.equal(f.state.writes,writes);
});
test('scanner: pending detection after manual close cannot deliver a code',async()=>{
 const f=fixture(),reply=deferred();f.state.detect=()=>reply.promise;const tree=f.render();await flush();f.close(tree);reply.resolve([{format:'ean_13',rawValue:'synthetic-code'}]);await flush();assert.equal(f.state.codes.length,0);assert.equal(f.state.closed,1);
});
test('scanner: visibility and pagehide close only once and clear all timers',async()=>{
 const f=fixture();f.render();await flush();f.hide();f.leave();assert.equal(f.state.closed,1);assert.equal(f.state.timers.size,0);assert.equal(f.state.video.srcObject,null);
});
test('scanner: unmounted pending permission stops a late grant',async()=>{
 const f=fixture(),grant=deferred();f.state.media=()=>grant.promise;f.render();await flush();f.unmount();const writes=f.state.writes;grant.resolve(f.state.stream);await flush();assert.equal(f.state.stops,1);assert.equal(f.state.writes,writes);assert.equal(f.state.closed,0);
});
test('scanner: deadline stops existing stream and late detection cannot deliver',async()=>{
 const f=fixture(),reply=deferred();f.state.detect=()=>reply.promise;f.render();await flush();f.deadline();assert.equal(f.state.stops,1);const writes=f.state.writes;reply.resolve([{format:'ean_13',rawValue:'synthetic-code'}]);await flush();assert.equal(f.state.codes.length,0);assert.equal(f.state.writes,writes);
});
test('scanner: unmount before format support settles never requests permission',async()=>{
 const f=fixture(),formats=deferred();f.state.formats=()=>formats.promise;f.render();f.unmount();formats.resolve(['ean_13']);await flush();assert.equal(f.state.requests.length,0);
});
test('scanner: valid local code stops camera before callback and never requests audio',async()=>{
 const f=fixture();f.state.detect=async()=>[{format:'ean_13',rawValue:'synthetic-code'}];f.render();await flush();assert.deepEqual(f.state.codes,['synthetic-code']);assert.equal(f.state.requests[0].audio,false);assert.equal(f.state.video.srcObject,null);
});
test('scanner: failed permission remains manually closable with no active stream',async()=>{
 const f=fixture();f.state.media=async()=>{throw Error('synthetic denial');};const tree=f.render();await flush();f.close(tree);assert.equal(f.state.closed,1);assert.equal(f.state.stops,0);
});

test('scanner: deadline while permission pending stops late grant and close still works',async()=>{
 const f=fixture(),grant=deferred();f.state.media=()=>grant.promise;const tree=f.render();await flush();f.deadline();const writes=f.state.writes;grant.resolve(f.state.stream);await flush();assert.equal(f.state.stops,1);assert.equal(f.state.video.srcObject,null);assert.equal(f.state.writes,writes);f.close(tree);assert.equal(f.state.closed,1);
});
test('scanner: close during pending video playback suppresses scan and message updates',async()=>{
 const f=fixture(),play=deferred();f.state.video.play=()=>play.promise;let detections=0;f.state.detect=async()=>{detections++;return[];};const tree=f.render();await flush();f.close(tree);const writes=f.state.writes;play.resolve();await flush();assert.equal(detections,0);assert.equal(f.state.stops,1);assert.equal(f.state.writes,writes);
});
test('scanner: retained close after unmount is inert and all scheduled work is removed',async()=>{
 const f=fixture(),tree=f.render();await flush();f.unmount();const writes=f.state.writes;f.close(tree);assert.equal(f.state.closed,0);assert.equal(f.state.stops,1);assert.equal(f.state.timers.size,0);assert.equal(f.state.writes,writes);
});
