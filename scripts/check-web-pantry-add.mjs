// Actual web manual pantry-add form; synthetic React/UI/network, no hosted writes.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {runInNewContext} from 'node:vm';
const mocks={
 react:`export const useState=initial=>{const i=state.cursor++;if(!(i in state.values))state.values[i]=initial;return[state.values[i],v=>{state.writes++;state.values[i]=typeof v==='function'?v(state.values[i]):v;}];};export const useRef=initial=>state.refs[state.cursor++]??={current:initial};export const useEffect=(fn,deps)=>{const i=state.cursor++;if(!state.deps[i]||deps.some((v,n)=>v!==state.deps[i][n])){state.deps[i]=deps;state.effects.push(()=>{state.cleanup[i]?.();state.setup[i]=fn;state.cleanup[i]=fn();});}};`,
 'react/jsx-runtime':`export const jsx=(type,props)=>({type,props});export const jsxs=jsx;export const Fragment='Fragment';`,
 '@seconds/core/format':`export {parsePantryInput} from './packages/core/src/pantry.ts';export const formatAmount=()=>'',pantryAttention=()=>null;`,
 '@/ui':`export const Button='Button',FieldRow='FieldRow',TextField='TextField';`,
 './pantry.module.css':`export default {};`,
};
const bundle=await build({bundle:true,write:false,format:'iife',globalName:'app',jsx:'automatic',entryPoints:['apps/web/modules/pantry/PantryList.tsx'],plugins:[{name:'boundaries',setup(api){api.onResolve({filter:/.*/},a=>Object.hasOwn(mocks,a.path)?{path:a.path,namespace:'mock'}:undefined);api.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js',resolveDir:process.cwd()}));}}]});
const nodes=t=>Array.isArray(t)?t.flatMap(nodes):t&&typeof t==='object'?[t,...nodes(t.props?.children)]:[];
const text=t=>Array.isArray(t)?t.map(text).join(' '):t&&typeof t==='object'?text(t.props?.children):String(t??'');
const field=t=>nodes(t).find(n=>n.type==='TextField'&&n.props['aria-label']==='Ingredients to add to your pantry');
const form=t=>nodes(t).find(n=>n.type==='form');
const button=(t,label)=>nodes(t).find(n=>n.type==='Button'&&text(n)===label);
const flush=()=>new Promise(r=>setImmediate(r));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const submit=t=>form(t).props.onSubmit({preventDefault(){}});
function fixture(){const state={cursor:0,values:[],refs:[],deps:[],effects:[],cleanup:[],setup:[],writes:0,calls:[]};const props={items:[],onAdd:async value=>{state.calls.push(value);return true;},onUpdate:async()=>true,onRemove:async()=>true,onClear:async()=>true};const context={state};runInNewContext(bundle.outputFiles[0].text,context);const render=()=>{state.cursor=0;const tree=context.app.PantryList(props);state.effects.splice(0).forEach(fn=>fn());return tree;};return{state,props,render,replayEffects:()=>{state.cleanup.filter(Boolean).forEach(fn=>fn());state.setup.forEach((fn,i)=>{state.cleanup[i]=fn();});},unmount:()=>state.cleanup.filter(Boolean).forEach(fn=>fn())};}
const enter=(f,value='2 bananas, rice')=>field(f.render()).props.onChange({target:{value}});

test('duplicate immediate submits send only one pantry write',async()=>{const f=fixture(),gate=deferred();f.props.onAdd=value=>{f.state.calls.push(value);return gate.promise;};enter(f);const old=f.render();submit(old);submit(old);assert.equal(f.state.calls.length,1);gate.resolve(true);await flush();});

test('pending input is retained and queued edits cannot change or lose the entry',async()=>{const f=fixture(),gate=deferred();f.props.onAdd=value=>{f.state.calls.push(value);return gate.promise;};enter(f);const old=f.render();submit(old);field(old).props.onChange({target:{value:'9 onions'}});assert.equal(field(f.render()).props.value,'2 bananas, rice');assert.equal(field(f.render()).props.disabled,true);gate.resolve(false);await flush();assert.equal(field(f.render()).props.value,'2 bananas, rice');assert.match(text(f.render()),/could not confirm/);});

test('uncertain entry retries unchanged and refuses edits until deliberate discard',async()=>{const f=fixture();f.props.onAdd=async value=>{f.state.calls.push(value);return false;};enter(f);submit(f.render());await flush();field(f.render()).props.onChange({target:{value:'9 onions'}});submit(f.render());await flush();assert.deepEqual(f.state.calls,['2 bananas, rice','2 bananas, rice']);assert.equal(field(f.render()).props.value,'2 bananas, rice');});

test('confirmed Add clears only after response and stale handlers cannot erase the next entry',async()=>{const f=fixture(),gate=deferred();f.props.onAdd=value=>{f.state.calls.push(value);return gate.promise;};enter(f);const old=f.render();submit(old);assert.equal(field(f.render()).props.value,'2 bananas, rice');gate.resolve(true);await flush();assert.equal(field(f.render()).props.value,'');enter(f,'3 pears');submit(old);field(old).props.onChange({target:{value:'stale'}});assert.equal(f.state.calls.length,1);assert.equal(field(f.render()).props.value,'3 pears');});

test('throwing callback releases busy state, retains exact input and hides provider details',async()=>{const f=fixture();f.props.onAdd=async()=>{throw Error('private provider payload');};enter(f);submit(f.render());await flush();assert.equal(field(f.render()).props.value,'2 bananas, rice');assert.equal(button(f.render(),'Retry the same pantry entry').props.disabled,false);assert.match(text(f.render()),/could not confirm/);assert.doesNotMatch(text(f.render()),/private provider payload/);});

test('discard warns and only removes local entry; old confirmation cannot discard a replacement',async()=>{const f=fixture();let removals=0;f.props.onRemove=async()=>{removals++;return true;};f.props.onClear=f.props.onRemove;f.props.onAdd=async value=>{f.state.calls.push(value);return false;};enter(f);submit(f.render());await flush();button(f.render(),'Discard local pantry entry').props.onClick();const old=f.render();assert.match(text(old),/does not remove pantry items or cancel the request/);assert.equal(field(old).props.value,'2 bananas, rice');button(old,'Discard this local entry').props.onClick();assert.equal(field(f.render()).props.value,'');enter(f,'3 pears');submit(f.render());await flush();button(old,'Discard this local entry').props.onClick();assert.equal(field(f.render()).props.value,'3 pears');assert.equal(removals,0);});

test('discard cannot run during a retry, including retained confirmation callbacks',async()=>{const f=fixture(),gate=deferred();f.props.onAdd=async()=>false;enter(f);submit(f.render());await flush();button(f.render(),'Discard local pantry entry').props.onClick();const old=f.render();f.props.onAdd=()=>gate.promise;submit(f.render());button(old,'Discard this local entry').props.onClick();assert.equal(field(f.render()).props.value,'2 bananas, rice');gate.resolve(true);await flush();assert.equal(field(f.render()).props.value,'');});

test('unmount refuses late completion and retained input/submit callbacks',async()=>{const f=fixture(),gate=deferred();f.props.onAdd=value=>{f.state.calls.push(value);return gate.promise;};enter(f);const old=f.render();submit(old);f.unmount();const writes=f.state.writes;gate.resolve(true);await flush();submit(old);field(old).props.onChange({target:{value:'stale'}});assert.equal(f.state.writes,writes);assert.equal(f.state.calls.length,1);});

test('keyboard submission uses latest input even before a render',async()=>{const f=fixture();const old=f.render();field(old).props.onChange({target:{value:'3 pears'}});submit(old);await flush();assert.deepEqual(f.state.calls,['3 pears']);});

test('blank and separator-only input send nothing and remain editable',async()=>{const f=fixture();enter(f,' ');submit(f.render());await flush();assert.equal(button(f.render(),'Add').props.disabled,true);enter(f,' , ; ');submit(f.render());await flush();assert.equal(f.state.calls.length,0);assert.equal(field(f.render()).props.disabled,false);assert.match(text(f.render()),/Nothing was sent/);enter(f,'3 pears');assert.doesNotMatch(text(f.render()),/Nothing was sent/);});

test('development effect cleanup and setup replay keeps the Add form usable',async()=>{const f=fixture();const old=f.render();f.replayEffects();field(old).props.onChange({target:{value:'3 pears'}});submit(old);await flush();assert.deepEqual(f.state.calls,['3 pears']);assert.equal(field(f.render()).props.value,'');});
