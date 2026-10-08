// Actual barcode component with synthetic React, auth, camera and network boundaries.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {runInNewContext} from 'node:vm';
const mocks={react:`export const useState=initial=>{const i=state.cursor++;if(!(i in state.values))state.values[i]=typeof initial==='function'?initial():initial;return[state.values[i],v=>{state.writes++;state.values[i]=typeof v==='function'?v(state.values[i]):v;}];};
 export const useRef=initial=>{const i=state.cursor++;return state.refs[i]??= {current:initial};};
 export const useMemo=(fn,deps)=>{const i=state.cursor++;if(!state.deps[i]||deps.some((v,n)=>v!==state.deps[i][n])){state.deps[i]=deps;state.memos[i]=fn();}return state.memos[i];};
 export const useCallback=(fn,deps)=>useMemo(()=>fn,deps);
 export const useEffect=(fn,deps)=>{const i=state.cursor++;if(!state.deps[i]||deps.some((v,n)=>v!==state.deps[i][n])){state.deps[i]=deps;state.effects.push(()=>{state.cleanups[i]?.();state.cleanups[i]=fn();});}};`,
 'react/jsx-runtime':`export const jsx=(type,props)=>({type,props});export const jsxs=jsx;export const Fragment='Fragment';`,
 '@clerk/nextjs':`export const useAuth=()=>state.auth;`,
 'next/link':`export default 'Link';`,
 '@/lib/action-failure':`export const signInReturnHref=()=>'/sign-in';`,
 '@seconds/core/format':`export const parseProductBarcode=code=>code;export const createClient=config=>Object.fromEntries(['barcodeLookupStatus','lookupProductBarcode','createPantryIntake'].map(method=>[method,async(...args)=>{state.calls.push({session:config.expectedSessionId,method,args});return state.respond(method,...args);} ]));`,
 '@/ui':`export const Button='Button',Callout='Callout',FieldRow='FieldRow',Panel='Panel',PanelHeader='PanelHeader',TextField='TextField';`,
 './BrowserBarcodeScanner':`export const BrowserBarcodeScanner='Scanner';`,
};
const bundle=await build({bundle:true,write:false,format:'iife',globalName:'app',jsx:'automatic',stdin:{resolveDir:process.cwd(),contents:"export {BarcodeCapture} from './apps/web/modules/pantry/BarcodeCapture.tsx';"},plugins:[{name:'barcode-boundaries',setup(api){api.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'mock'}:undefined);api.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js'}));}}]});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function nodes(tree){return Array.isArray(tree)?tree.flatMap(nodes):tree&&typeof tree==='object'?[tree,...nodes(tree.props?.children)]:[];}
function text(tree){return Array.isArray(tree)?tree.map(text).join(' '):tree&&typeof tree==='object'?text(tree.props?.children):String(tree??'');}
const forms=tree=>nodes(tree).filter(n=>n.type==='form');
const button=(tree,label)=>nodes(tree).find(n=>n.type==='Button'&&text(n.props.children)===label);
const submit=form=>form.props.onSubmit({preventDefault(){}});
function fixture(){
 const state={cursor:0,values:[],refs:[],deps:[],memos:[],effects:[],cleanups:[],writes:0,calls:[],queued:0,uuid:0,auth:{isLoaded:true,userId:'synthetic-account-a',sessionId:'synthetic-session-a'},respond:async method=>method==='barcodeLookupStatus'?{enabled:true}:method==='lookupProductBarcode'?{product:null}:{} };
 const ctx={state,crypto:{randomUUID:()=>`synthetic-reference-${++state.uuid}`},document:{getElementById:()=>({focus(){}})},window:{confirm:()=>true}};runInNewContext(bundle.outputFiles[0].text,ctx);
 const outer=ctx.app.BarcodeCapture({clerkEnabled:true,onQueued:()=>state.queued++});const inner=outer.type(outer.props);
 const render=(commit=true)=>{state.cursor=0;const tree=inner.type({...inner.props,userId:state.auth.userId,sessionId:state.auth.sessionId});if(commit)state.effects.splice(0).forEach(fn=>fn());return tree;};
 const unmount=()=>state.cleanups.filter(Boolean).forEach(fn=>fn());
 const enter=()=>{const tree=render();nodes(tree).find(n=>n.props?.id==='pantry-product-name').props.onChange({target:{value:'Synthetic beans'}});};
 return {state,render,unmount,enter};
}
test('barcode: retained unmounted queue and lookup cannot dispatch or update state',async()=>{
 const f=fixture();f.render();await flush();f.enter();const tree=f.render();f.unmount();const calls=f.state.calls.length,writes=f.state.writes;submit(forms(tree)[1]);await flush();submit(forms(tree)[0]);await flush();assert.equal(f.state.calls.length,calls);assert.equal(f.state.writes,writes);
});
test('barcode: pending same-account session change before cleanup cannot confirm old queue',async()=>{
 const f=fixture();f.render();await flush();f.enter();const reply=deferred();f.state.respond=()=>reply.promise;submit(forms(f.render())[1]);f.state.auth.sessionId='synthetic-session-b';f.render(false);const writes=f.state.writes;reply.resolve({});await flush();assert.equal(f.state.queued,0);assert.equal(f.state.writes,writes);f.unmount();
});
test('barcode: old-session retained queue cannot dispatch after replacement',async()=>{
 const f=fixture();f.render();await flush();f.enter();const old=f.render();f.state.auth.sessionId='synthetic-session-b';f.render();await flush();const calls=f.state.calls.length;submit(forms(old)[1]);await flush();assert.equal(f.state.calls.length,calls);
});
test('barcode: old availability result ignored before new-session effect cleanup',async()=>{
 const f=fixture(),reply=deferred();f.state.respond=()=>reply.promise;f.render();f.state.auth.sessionId='synthetic-session-b';f.render(false);const writes=f.state.writes;reply.resolve({enabled:true});await flush();assert.equal(f.state.writes,writes);f.unmount();
});
test('barcode: retained camera callback after unmount cannot restore private entry',async()=>{
 const f=fixture();f.render();await flush();button(f.render(),'Scan barcode with camera').props.onClick();const scanner=nodes(f.render()).find(n=>n.type==='Scanner');f.unmount();const writes=f.state.writes;scanner.props.onCode('synthetic-code');scanner.props.onClose();assert.equal(f.state.writes,writes);
});
test('barcode: failed queue keeps exact request reference and editable facts for explicit retry',async()=>{
 const f=fixture();f.render();await flush();f.enter();let failed=true;f.state.respond=async()=>{if(failed)throw Error('private diagnostic');return{};};submit(forms(f.render())[1]);await flush();assert.match(text(f.render()),/kept unchanged for a safe retry/);assert.doesNotMatch(text(f.render()),/private diagnostic/);failed=false;submit(forms(f.render())[1]);await flush();const requests=f.state.calls.filter(c=>c.method==='createPantryIntake');assert.equal(requests.length,2);assert.deepEqual(requests[0].args,requests[1].args);assert.equal(f.state.queued,1);assert.match(text(f.render()),/queued for review/);
});
test('barcode: dispatched queue settlement after unmount cannot claim saved',async()=>{
 const f=fixture();f.render();await flush();f.enter();const reply=deferred();f.state.respond=()=>reply.promise;submit(forms(f.render())[1]);f.unmount();const writes=f.state.writes;reply.resolve({});await flush();assert.equal(f.state.queued,0);assert.equal(f.state.writes,writes);
});

test('barcode: old entry is hidden before new session cleanup and retained edits are ignored',async()=>{
 const f=fixture();f.render();await flush();f.enter();const old=f.render();f.state.auth.sessionId='synthetic-session-b';assert.doesNotMatch(text(f.render(false)),/Synthetic beans/);const writes=f.state.writes;nodes(old).find(n=>n.props?.id==='pantry-product-name').props.onChange({target:{value:'old edit'}});button(old,'Scan barcode with camera').props.onClick();assert.equal(f.state.writes,writes);f.unmount();
});
test('barcode: pending lookup result and error cannot change a replacement account',async()=>{
 for(const reject of [false,true]){const f=fixture();f.render();await flush();const reply=deferred();f.state.respond=()=>reply.promise;submit(forms(f.render())[0]);f.state.auth={isLoaded:true,userId:'synthetic-account-b',sessionId:'synthetic-session-b'};f.state.respond=async()=>({enabled:true});f.render();await flush();const writes=f.state.writes;reject?reply.reject(Error('old private diagnostic')):reply.resolve({product:{displayName:'old private product'}});await flush();assert.equal(f.state.writes,writes);assert.doesNotMatch(text(f.render()),/old private/);}
});
test('barcode: current lookup remains editable and never automatically queues inventory',async()=>{
 const f=fixture();f.render();await flush();f.state.respond=async()=>({product:{displayName:'Synthetic beans',brand:'Synthetic brand',sourceUrl:'https://fixture.invalid'}});submit(forms(f.render())[0]);await flush();const field=nodes(f.render()).find(n=>n.props?.id==='pantry-product-name');assert.equal(field.props.value,'Synthetic beans');assert.equal(field.props.disabled,false);assert.equal(f.state.calls.filter(c=>c.method==='createPantryIntake').length,0);assert.equal(f.state.queued,0);
});
