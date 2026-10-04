// Actual web/native picker and shared pantry matching; synthetic hooks/API/router.
// No real inventory, provider, device or rendered-accessibility acceptance.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';
const mocks={
 react:`export const useState=v=>{const i=state.cursor++;if(!(i in state.values))state.values[i]=typeof v==='function'?v():v;return[state.values[i],v=>state.values[i]=typeof v==='function'?v(state.values[i]):v];};export const useRef=v=>state.values[state.cursor++]??={current:v};export const useCallback=(fn,deps)=>{const i=state.cursor++;if(!state.deps[i]||deps.some((v,n)=>v!==state.deps[i][n])){state.deps[i]=deps;state.values[i]=fn;}return state.values[i];};export const useEffect=(fn,deps)=>{const i=state.cursor++;if(!state.deps[i]||deps.some((v,n)=>v!==state.deps[i][n])){state.cleanups[i]?.();state.deps[i]=deps;state.effects.push(()=>state.cleanups[i]=fn());}};`,
 'react/jsx-runtime':`export const Fragment='Fragment';export const jsx=(type,props)=>({type,props});export const jsxs=jsx;`,
 'react-native':`export const Text='Text',View='View';`,
 'expo-router':`import {useEffect} from 'react';export const useRouter=()=>({push:path=>state.routes.push(path)});export const useFocusEffect=fn=>useEffect(()=>{state.focus=fn;state.blur=fn();return()=>state.blur?.();},[fn]);`,
 'next/link':`export default 'Link';`,
 '@/ui':`export const Button='Button',Callout='Callout',Field='Field',TextField='TextField',space={sm:8},type={body:16},usePalette=()=>({text:'#fff',textMuted:'#ccc',border:'#888'});`,
 '@seconds/core/format':`export {formatAmount} from './packages/core/src/units.ts';export {pantryAttention} from './packages/core/src/pantry-guidance.ts';export {pantryPlanningMatches} from './packages/core/src/plan-together.ts';`,
};
const bundle=await build({bundle:true,write:false,format:'iife',globalName:'app',jsx:'automatic',stdin:{resolveDir:process.cwd(),contents:`export {PantryPlanningPicker as Native} from './apps/mobile/modules/today/PantryPlanningPicker.tsx';export {PantryPlanningPicker as Web} from './apps/web/modules/today/PantryPlanningPicker.tsx';`},plugins:[{name:'read-only-planning-boundaries',setup(api){api.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'mock'}:args.path.endsWith('.css')?{path:args.path,namespace:'css'}:undefined);api.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js',resolveDir:process.cwd()}));api.onLoad({filter:/.*/,namespace:'css'},()=>({contents:'export default {};'}));}}]});
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const sample={canonicalItem:'banana',displayName:'Bananas',quantity:6,unit:'count',confidence:'needs_review'};
function nodes(t){return Array.isArray(t)?t.flatMap(nodes):t&&typeof t==='object'?[t,...nodes(t.props?.children)]:[];}
function text(t){return Array.isArray(t)?t.map(text).join(' '):t&&typeof t==='object'?text(t.props?.children):t==null?'':String(t);}
function fixture(platform){
 const state={cursor:0,values:[],deps:[],cleanups:[],effects:[],calls:0,chosen:[],routes:[],disabled:false};
 state.load=async()=>[sample];const client={listPantry:()=>{state.calls++;return state.load();}};
 const context={state};runInNewContext(bundle.outputFiles[0].text,context);
 const render=()=>{state.cursor=0;const tree=context.app[platform]({client,disabled:state.disabled,onChoose:item=>state.chosen.push(item)});state.effects.splice(0).forEach(fn=>fn());return tree;};
 const button=label=>{const found=nodes(render()).find(n=>n.type==='Button'&&(n.props.label??text(n)).replace(/\s+/g,' ').trim()===label);assert.ok(found,`Missing ${label}`);return found;};
 const press=label=>{const b=button(label);assert.equal(!!b.props.disabled,false);(b.props.onPress??b.props.onClick)();};
 const settle=async()=>{for(let i=0;i<3;i++){render();await flush();}return render();};
 const unmount=()=>state.cleanups.filter(Boolean).forEach(fn=>fn());
 render();if(platform==='Native')press('Check what your pantry thinks is still there');
 return{state,render,button,press,settle,unmount};
}
for(const platform of ['Web','Native']){
 test(`${platform}: pantry check is opt-in; choosing only returns the saved item`,async()=>{const f=fixture(platform);assert.equal(f.state.calls,0);f.press('Check my pantry');await f.settle();assert.match(text(f.render()),/not a stock check/);f.press('Use Bananas for meal ideas');assert.equal(f.state.calls,1);assert.deepEqual(f.state.chosen,[sample]);assert.match(text(f.render()),/needs your review/);});
 test(`${platform}: failed refresh clears stale choices without claiming an empty pantry`,async()=>{const f=fixture(platform);f.press('Check my pantry');await f.settle();f.state.load=async()=>{throw Error('private API detail');};f.press('Refresh pantry choices');await f.settle();assert.match(text(f.render()),/could not load/);assert.doesNotMatch(text(f.render()),/No saved pantry items|private API detail|Use Bananas/);f.state.load=async()=>[];f.press('Check my pantry');await f.settle();assert.match(text(f.render()),/No saved pantry items/);assert.doesNotMatch(text(f.render()),/could not load/);});
 test(`${platform}: pending read blocks duplicates and unmount withholds late items`,async()=>{const f=fixture(platform),gate=deferred();f.state.load=()=>gate.promise;f.press('Check my pantry');const b=f.button('Loading pantry choices…');assert.equal(b.props.disabled,true);(b.props.onPress??b.props.onClick)();assert.equal(f.state.calls,1);f.unmount();gate.resolve([sample]);await flush();assert.doesNotMatch(text(f.render()),/Use Bananas/);assert.equal(f.state.chosen.length,0);});
 test(`${platform}: search is local and no-match does not imply absence`,async()=>{const f=fixture(platform);f.press('Check my pantry');await f.settle();const field=nodes(f.render()).find(n=>n.type===(platform==='Web'?'TextField':'Field'));if(platform==='Web')field.props.onChange({target:{value:'not a saved name'}});else field.props.onChangeText('not a saved name');assert.match(text(f.render()),/No saved name matches/);assert.equal(f.state.calls,1);assert.equal(f.state.chosen.length,0);f.press('Clear pantry name search');f.press('Use Bananas for meal ideas');assert.equal(f.state.calls,1);});
}
test('Native: focus reentry clears old snapshot and ignores old pending read',async()=>{const f=fixture('Native'),gate=deferred();f.state.load=()=>gate.promise;f.press('Check my pantry');f.state.blur();f.state.blur=f.state.focus();gate.resolve([sample]);await f.settle();assert.doesNotMatch(text(f.render()),/Use Bananas/);assert.equal(f.button('Check my pantry').props.disabled,false);});
test('Native: pending pantry read forwards accessible busy state',async()=>{const f=fixture('Native'),gate=deferred();f.state.load=()=>gate.promise;f.press('Check my pantry');assert.equal(f.button('Loading pantry choices…').props.busy,true);gate.resolve([]);await f.settle();});
test('Web: pending read exposes aria-busy and clears it after settlement',async()=>{const f=fixture('Web'),gate=deferred();f.state.load=()=>gate.promise;f.press('Check my pantry');assert.equal(f.button('Loading pantry choices…').props['aria-busy'],true);gate.resolve([]);await f.settle();assert.equal(f.button('Refresh pantry choices').props['aria-busy'],false);});
