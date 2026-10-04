// Actual component, synthetic API/camera boundaries. Not device acceptance.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
const mocks = {
  react: `export const useState=initial=>{const i=state.cursor++;if(!(i in state.values))state.values[i]=initial;return [state.values[i],v=>state.values[i]=typeof v==='function'?v(state.values[i]):v];};export const useEffect=(fn,deps)=>{const i=state.cursor++;if(!state.deps[i]||deps.some((v,n)=>v!==state.deps[i][n])){state.cleanups[i]?.();state.deps[i]=deps;state.effects.push(()=>state.cleanups[i]=fn());}};`,
  'react/jsx-runtime': `export const Fragment='Fragment';export const jsx=(type,props)=>({type,props});export const jsxs=jsx;`,
  'react-native': `export const View='View',Text='Text';export const StyleSheet={create:v=>v};`,
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
  const state={cursor:0,values:[],deps:[],effects:[],cleanups:[],requests:[],timers:[],scans:[],
    permission:async()=>({granted:true}),picker:async()=>({canceled:false,assets:[{mimeType:'image/jpeg',base64:'synthetic'}]}),scan:async()=>true};
  const context={state,setTimeout:fn=>{state.timers.push(fn);return fn;},clearTimeout:fn=>state.timers=state.timers.filter(t=>t!==fn)};
  runInNewContext(bundle.outputFiles[0].text,context);
  const render=()=>{state.cursor=0;const tree=context.app.ReceiptCapture({onScan:async(...args)=>{state.scans.push(args);return state.scan(...args);}});state.effects.splice(0).forEach(fn=>fn());return tree;};
  return {state,render};
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
test('rejected write is not reported as a saved review',async()=>{const f=await enabled();f.state.scan=async()=>false;await button(f.render(),'Choose receipt photo').props.onPress();await flush();assert.match(text(f.render()),/not saved for review/);assert.doesNotMatch(text(f.render()),/Receipt ready/);});
test('successful upload is review only, not pantry inventory',async()=>{const f=await enabled();await button(f.render(),'Choose receipt photo').props.onPress();await flush();assert.match(text(f.render()),/Nothing was added to your pantry yet/);assert.equal(f.state.scans.length,1);});
test('both actions stay disabled while permission is pending',async()=>{const f=await enabled();let finish;f.state.permission=()=>new Promise(resolve=>finish=resolve);button(f.render(),'Take receipt photo').props.onPress();assert.ok(nodes(f.render()).filter(n=>n.type==='Button').every(n=>n.props.disabled));finish({granted:false});await flush();assert.equal(button(f.render(),'Choose receipt photo').props.disabled,false);});
test('throwing scan recovers without exposing provider details or claiming success',async()=>{const f=await enabled();f.state.scan=async()=>{throw Error('private provider details');};button(f.render(),'Choose receipt photo').props.onPress();await flush();assert.match(text(f.render()),/could not be read/);assert.doesNotMatch(text(f.render()),/private provider details|Receipt ready/);assert.equal(button(f.render(),'Choose receipt photo').props.disabled,false);});
