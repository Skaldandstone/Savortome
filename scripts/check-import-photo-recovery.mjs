import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {runInNewContext} from 'node:vm';
const mocks={
 react:`export const useState=v=>{const i=state.cursor++;if(!(i in state.values))state.values[i]=v;return[state.values[i],v=>{state.writes++;state.values[i]=typeof v==='function'?v(state.values[i]):v;}];};export const useRef=v=>state.values[state.cursor++]??={current:v};export const useEffect=(fn,deps)=>{const i=state.cursor++;if(!state.deps[i]||deps.some((v,n)=>v!==state.deps[i][n])){state.deps[i]=deps;state.effects.push(()=>state.cleanups[i]=fn());}};`,
 'react/jsx-runtime':`export const jsx=(type,props)=>({type,props});export const jsxs=jsx;export const Fragment='Fragment';`,
 '@/ui':`export const Button='Button',Callout='Callout',FieldRow='FieldRow',TextArea='TextArea',TextField='TextField';`,
 './ModeSwitch':`export const ModeSwitch='ModeSwitch';`,
 './import.module.css':`export default {};`,
 '@/lib/photo':`export const readAsBase64=(file,signal)=>{state.signals.push(signal);return state.read(file);};`,
 '@seconds/core/format':`export {isPhotoMediaType,MAX_PHOTO_BYTES} from './packages/core/src/recipe.ts';export const hintForUrl=()=>undefined;`,
};
const bundle=await build({bundle:true,write:false,format:'iife',globalName:'app',jsx:'automatic',stdin:{resolveDir:process.cwd(),contents:`export {ImportForm} from './apps/web/modules/import/ImportForm.tsx';`},plugins:[{name:'import-photo-boundaries',setup(api){api.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'mock'}:undefined);api.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js',resolveDir:process.cwd()}));}}]});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function nodes(t){return Array.isArray(t)?t.flatMap(nodes):t&&typeof t==='object'?[t,...nodes(t.props?.children)]:[];}
function words(t){return Array.isArray(t)?t.map(words).join(' '):t&&typeof t==='object'?words(t.props?.children):t==null?'':String(t);}
const file=name=>({name,type:'image/jpeg',size:100});
function fixture(){
 const state={signals:[],cursor:0,values:[],deps:[],effects:[],cleanups:[],writes:0,created:[],revoked:[],submitted:[],timers:new Map(),timer:0};state.read=async f=>'synthetic-'+f.name;
 const context={state,AbortController,URL:{createObjectURL:f=>{const url='blob:synthetic/'+f.name;state.created.push(url);return url;},revokeObjectURL:url=>state.revoked.push(url)},setTimeout:(fn,ms)=>{assert.equal(ms,30000);state.timers.set(++state.timer,fn);return state.timer;},clearTimeout:i=>state.timers.delete(i)};
 runInNewContext(bundle.outputFiles[0].text,context);let busy=false;
 const render=()=>{state.cursor=0;const tree=context.app.ImportForm({busy,onSubmit:r=>state.submitted.push(r)});while(state.effects.length)state.effects.shift()();return tree;};
 const find=type=>nodes(render()).find(n=>n.type===type);
 const mode=value=>find('ModeSwitch').props.onChange(value);
 const pick=f=>find('input').props.onChange({target:{files:[f]}});
 const submit=()=>find('form').props.onSubmit({preventDefault(){}});
 const unmount=()=>{for(const fn of state.cleanups)fn?.();};
 render();mode('photo');render();return{state,render,find,mode,pick,submit,unmount,busy:v=>{busy=v;render();}};
}
test('import photo: newer selection wins despite reverse read completion',async()=>{const f=fixture(),a=deferred(),b=deferred();f.state.read=x=>x.name==='a'?a.promise:b.promise;f.pick(file('a'));f.pick(file('b'));b.resolve('newer');await flush();a.resolve('older');await flush();f.submit();assert.equal(f.state.submitted[0]?.imageBase64,'newer');assert.deepEqual(f.state.created,['blob:synthetic/b']);});
test('import photo: replacement disables submit and failure never resubmits old bytes',async()=>{const f=fixture();f.pick(file('old'));await flush();const gate=deferred();f.state.read=()=>gate.promise;f.pick(file('new'));f.submit();assert.equal(f.state.submitted.length,0);assert.equal(f.find('Button').props.disabled,true);gate.reject(Error('private synthetic details'));await flush();f.submit();assert.equal(f.state.submitted.length,0);assert.doesNotMatch(words(f.render()),/private synthetic/);assert.deepEqual(f.state.revoked,['blob:synthetic/old']);});
test('import photo: unmount releases current preview and ignores late read',async()=>{const f=fixture();f.pick(file('old'));await flush();const gate=deferred();f.state.read=()=>gate.promise;f.pick(file('new'));f.unmount();const writes=f.state.writes;gate.resolve('late');await flush();assert.equal(f.state.writes,writes);assert.deepEqual(f.state.created,['blob:synthetic/old']);assert.deepEqual(f.state.revoked,['blob:synthetic/old']);});
test('import photo: mode switch discards photo and ignores pending completion',async()=>{const f=fixture(),gate=deferred();f.state.read=()=>gate.promise;f.pick(file('late'));f.mode('text');gate.resolve('late');await flush();f.mode('photo');assert.equal(f.find('Button').props.disabled,true);assert.deepEqual(f.state.created,[]);});
test('import photo: invalid replacement clears old preview and blocks submit before reading',async()=>{const f=fixture();f.pick(file('old'));await flush();let reads=0;f.state.read=async()=>{reads++;return 'bad';};f.pick({type:'image/gif',size:100});await flush();f.submit();assert.equal(reads,0);assert.equal(f.state.submitted.length,0);assert.deepEqual(f.state.revoked,['blob:synthetic/old']);});
test('import photo: preparation timeout permits explicit retry without late replacement',async()=>{const f=fixture(),gate=deferred();f.state.read=()=>gate.promise;f.pick(file('late'));assert.equal(f.state.timers.size,1);for(const fn of [...f.state.timers.values()])fn();await flush();assert.match(words(f.render()),/Try again/);f.state.read=async()=>'retry';f.pick(file('retry'));await flush();gate.resolve('late');await flush();f.submit();assert.equal(f.state.submitted[0]?.imageBase64,'retry');});

test('import photo: stale failed read cannot erase newer success or expose old error',async()=>{const f=fixture(),gate=deferred();f.state.read=()=>gate.promise;f.pick(file('old'));f.state.read=async()=>'current';f.pick(file('current'));await flush();gate.reject(Error('private old failure'));await flush();f.submit();assert.equal(f.state.submitted[0]?.imageBase64,'current');assert.doesNotMatch(words(f.render()),/Couldn.t read/);});
test('import photo: confirmed preview released once on mode change and unmount',async()=>{const f=fixture();f.pick(file('one'));await flush();f.mode('url');f.unmount();assert.deepEqual(f.state.revoked,['blob:synthetic/one']);});
test('import photo: busy import rejects new picks and mode changes without losing selection',async()=>{const f=fixture();f.pick(file('one'));await flush();f.busy(true);let reads=0;f.state.read=async()=>{reads++;return 'two';};f.pick(file('two'));f.mode('text');await flush();assert.equal(reads,0);assert.deepEqual(f.state.revoked,[]);f.busy(false);f.submit();assert.equal(f.state.submitted[0]?.imageBase64,'synthetic-one');});

test('import photo cancellation: replacement, mode switch, timeout and unmount abort associated reads',async()=>{for(const reason of ['replacement','mode','timeout','unmount']){const f=fixture(),gate=deferred();f.state.read=()=>gate.promise;f.pick(file('first'));const signal=f.state.signals[0];assert.equal(signal.aborted,false);if(reason==='replacement')f.pick(file('second'));if(reason==='mode')f.mode('text');if(reason==='timeout')for(const fn of [...f.state.timers.values()])fn();if(reason==='unmount')f.unmount();assert.equal(signal.aborted,true,reason);gate.resolve('late');await flush();assert.equal(f.state.submitted.length,0);f.unmount();}});
