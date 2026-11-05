// Actual Care component and shared receipt contract; synthetic auth/API, no hosted writes.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {runInNewContext} from 'node:vm';
const mocks={
 react:`export const useMemo=fn=>fn();export const useState=initial=>{const i=state.cursor++;if(!(i in state.values))state.values[i]=typeof initial==='function'?initial():initial;return[state.values[i],v=>{state.writes++;state.values[i]=typeof v==='function'?v(state.values[i]):v;}];};export const useRef=initial=>state.refs[state.cursor++]??={current:initial};export const useEffect=(fn,deps)=>{const i=state.cursor++;if(!state.deps[i]||deps.some((v,n)=>v!==state.deps[i][n])){state.deps[i]=deps;state.effects.push(()=>{state.cleanup[i]?.();state.setup[i]=fn;state.cleanup[i]=fn();});}};`,
 'react/jsx-runtime':`export const jsx=(type,props)=>({type,props});export const jsxs=jsx;export const Fragment='Fragment';`,
 '@clerk/nextjs':`export const useAuth=()=>({userId:state.account});`,
 '@/lib/client':`export const api={addItemsToList:items=>{state.calls.push(items);return state.save(items);}};`,
 './care.module.css':`export default {};`,
 '@/modules/woodland/FoodIllustration':`export const FoodIllustration='FoodIllustration';`,
 '@/modules/woodland/KitchenIcon':`export const KitchenIcon='KitchenIcon';`,
};
const bundle=await build({bundle:true,write:false,format:'iife',globalName:'app',define:{'process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY':'""'},jsx:'automatic',entryPoints:['apps/web/modules/care/CareScreen.tsx'],plugins:[{name:'boundaries',setup(api){api.onResolve({filter:/.*/},a=>Object.hasOwn(mocks,a.path)?{path:a.path,namespace:'mock'}:undefined);api.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:mocks[a.path],loader:'js',resolveDir:process.cwd()}));}}]});
const nodes=t=>Array.isArray(t)?t.flatMap(nodes):t&&typeof t==='object'?[t,...nodes(t.props?.children)]:[];
const text=t=>Array.isArray(t)?t.map(text).join(' '):t&&typeof t==='object'?text(t.props?.children):String(t??'');

const flush=()=>new Promise(r=>setImmediate(r));
const button=(t,label)=>nodes(t).find(n=>n.type==='button'&&text(n)===label);
const adds=t=>nodes(t).filter(n=>n.type==='button'&&n.props['aria-label']?.startsWith('Add '));
function fixture(){const state={cursor:0,values:[],refs:[],deps:[],effects:[],cleanup:[],setup:[],writes:0,calls:[],account:'synthetic-account'};state.save=async items=>({items:items.map((item,i)=>({...item,id:'line-'+i}))});const context={state,navigator:{onLine:true},setTimeout,clearTimeout,URLSearchParams,window:{confirm:()=>state.confirm!==false}};runInNewContext(bundle.outputFiles[0].text,context);const root=context.app.CareScreen({link:{}});const render=()=>{state.cursor=0;return root.type({...root.props,accountId:state.account});};return{state,render,offline:()=>{context.navigator.onLine=false;}};}

test('care: absent selected name cannot confirm a resolved write',async()=>{const f=fixture();f.state.save=async()=>({items:[]});adds(f.render())[0].props.onClick();await flush();assert.doesNotMatch(text(f.render()),/added to your shopping list/);assert.match(text(f.render()),/could not confirm/);});

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const receipt=items=>({items:items.map((item,i)=>({...item,id:'line-'+i}))});
test('care: pending duplicates and other ideas cannot replace the exact retry item',async()=>{
 const f=fixture(),gate=deferred();f.state.save=()=>gate.promise;const old=adds(f.render());old[0].props.onClick();old[0].props.onClick();old[1].props.onClick();assert.equal(f.state.calls.length,1);
 gate.resolve({items:[]});await flush();old[1].props.onClick();assert.equal(f.state.calls.length,1);
 nodes(f.render()).find(n=>n.type==='select'&&n.props['aria-label']==='How much preparation?').props.onChange({target:{value:'open'}});
 assert.match(text(f.render()),/could not confirm/);assert.ok(button(f.render(),'Retry the same list item'));
 f.state.save=async items=>receipt(items);button(f.render(),'Retry the same list item').props.onClick();await flush();assert.deepEqual(f.state.calls[1],f.state.calls[0]);assert.match(text(f.render()),/added to your shopping list/);assert.equal(button(f.render(),'Retry the same list item'),undefined);
});
test('care: thrown error hides private details, preserves selection and needs deliberate local discard',async()=>{
 const f=fixture();f.state.save=async()=>{throw Error('private service payload');};const old=adds(f.render());old[0].props.onClick();await flush();assert.doesNotMatch(text(f.render()),/private service payload/);
 f.state.confirm=false;button(f.render(),'Discard local retry selection').props.onClick();assert.ok(button(f.render(),'Retry the same list item'));assert.equal(f.state.calls.length,1);
 f.state.confirm=true;button(f.render(),'Discard local retry selection').props.onClick();assert.equal(button(f.render(),'Retry the same list item'),undefined);assert.equal(f.state.calls.length,1);
 f.state.save=async items=>receipt(items);adds(f.render())[1].props.onClick();await flush();assert.equal(f.state.calls.length,2);assert.notDeepEqual(f.state.calls[1],f.state.calls[0]);
});
test('care: offline retry never claims nothing saved or sends another write',async()=>{
 const f=fixture();f.state.save=async()=>({items:[]});adds(f.render())[0].props.onClick();await flush();
 // The retained browser surface becomes offline before explicit retry.
 f.offline();button(f.render(),'Retry the same list item').props.onClick();await flush();assert.equal(f.state.calls.length,1);assert.match(text(f.render()),/still unconfirmed/);assert.doesNotMatch(text(f.render()),/Nothing has been saved/);
});
test('care: unmount prevents late confirmation and retained dispatch',async()=>{
 const f=fixture();const old=adds(f.render());f.state.effects[0]();const cleanup=f.state.cleanup.find(Boolean);const gate=deferred();f.state.save=()=>gate.promise;old[0].props.onClick();const input=f.state.calls[0];cleanup();const writes=f.state.writes;gate.resolve(receipt(input));await flush();old[0].props.onClick();assert.equal(f.state.calls.length,1);assert.equal(f.state.writes,writes);
});
for(const account of [null,'synthetic-account']) test(`care: ${account?'offline':'guest'} action makes no write`,async()=>{const f=fixture();f.state.account=account;if(account)f.offline();adds(f.render())[0].props.onClick();await flush();assert.equal(f.state.calls.length,0);assert.doesNotMatch(text(f.render()),/added to your shopping list/);});

test('care: old account completion cannot confirm or release a replacement request',async()=>{
 const f=fixture();f.render();f.state.effects[0]();f.state.effects=[];
 const oldGate=deferred();f.state.save=()=>oldGate.promise;adds(f.render())[0].props.onClick();const oldInput=f.state.calls[0];
 f.state.account='replacement-account';f.render();f.state.effects[0]();f.state.effects=[];
 const newGate=deferred();f.state.save=()=>newGate.promise;adds(f.render())[1].props.onClick();oldGate.resolve(receipt(oldInput));await flush();assert.doesNotMatch(text(f.render()),/added to your shopping list/);assert.ok(adds(f.render()).every(n=>n.props.disabled));
 newGate.resolve(receipt(f.state.calls[1]));await flush();assert.match(text(f.render()),/added to your shopping list/);
});
