// Real web/mobile card bodies with synthetic React/write boundaries.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {runInNewContext} from 'node:vm';
const mocks={
 react:`export const useState=initial=>{const i=state.cursor++;if(!(i in state.values))state.values[i]=typeof initial==='function'?initial():initial;return [state.values[i],v=>state.values[i]=typeof v==='function'?v(state.values[i]):v];};export const useRef=()=>({current:{querySelector:()=>({focus:()=>state.focuses++})}});`,
 'react/jsx-runtime':`export const Fragment='Fragment';export const jsx=(type,props)=>({type,props});export const jsxs=jsx;`,
 'react-native':`export const View='View',Text='Text',Pressable='Pressable';export const StyleSheet={create:v=>v};`,
 '@seconds/core/format':`export const formatAmount=item=>String(item.quantity??'');`,
 '@/ui':`export const Button='Button',Callout='Callout';export const usePalette=()=>({text:'#eee',textMuted:'#baa',surface:'#19211b',border:'#897855'});export const radius={md:8},space={sm:8,md:12,lg:16},type={title:20,small:14,body:16,micro:12};`,
};
const result=await build({bundle:true,write:false,format:'iife',globalName:'app',jsx:'automatic',stdin:{resolveDir:process.cwd(),contents:`export {PantryReviewQueue as Web} from './apps/web/modules/pantry/PantryReviewQueue';export {PantryReviewQueue as Mobile} from './apps/mobile/modules/pantry/PantryReviewQueue';`},plugins:[{name:'boundaries',setup(api){api.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'mock'}:args.path.endsWith('.css')?{path:args.path,namespace:'css'}:undefined);api.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js'}));api.onLoad({filter:/.*/,namespace:'css'},()=>({contents:'export default {};'}));}}]});
function nodes(tree){return Array.isArray(tree)?tree.flatMap(nodes):tree&&typeof tree==='object'?[tree,...nodes(tree.props?.children)]:[];}
function text(tree){if(Array.isArray(tree))return tree.map(text).join(' ');if(tree&&typeof tree==='object')return text(tree.props?.children);return String(tree??'');}
const button=(tree,label)=>nodes(tree).find(n=>n.type==='Button'&&(n.props.label??text(n.props.children))===label);
const click=node=>node.props.onClick?.()??node.props.onPress?.();
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(platform){
 const state={cursor:0,values:[],calls:[],focuses:0,write:async()=>false};
 const context={state,Intl,Date};runInNewContext(result.outputFiles[0].text,context);
 const intake={id:'synthetic-review',source:'receipt',sourceLabel:'Synthetic groceries',acquiredAt:null,items:[{id:'banana',displayName:'bananas',quantity:6},{id:'oat',displayName:'oats',quantity:1}]};
 const onResolve=async(...args)=>{state.calls.push(args);return state.write(...args);};
 const queue=context.app[platform]({intakes:[intake],onResolve});
 const card=nodes(queue).find(n=>typeof n.type==='function');
 const render=()=>{state.cursor=0;return card.type(card.props);};
 const checkboxes=tree=>nodes(tree).filter(n=>platform==='Web'?n.type==='input':n.type==='Pressable');
 const uncheck=tree=>{const node=checkboxes(tree)[0];platform==='Web'?node.props.onChange({target:{checked:false}}):node.props.onPress();};
 const checked=tree=>checkboxes(tree).map(n=>platform==='Web'?n.props.checked:n.props.accessibilityState.checked);
 return {state,render,uncheck,checked};
}
for(const platform of ['Web','Mobile']){
 test(`${platform}: dismissal needs confirmation and cancel does not write`,()=>{const f=fixture(platform);f.uncheck(f.render());click(button(f.render(),'Dismiss'));assert.match(text(f.render()),/without adding any items/);assert.equal(f.state.calls.length,0);click(button(f.render(),'Keep reviewing'));assert.equal(f.state.calls.length,0);assert.deepEqual(f.checked(f.render()),[false,true]);if(platform==='Web')assert.equal(f.state.focuses,1);});
 test(`${platform}: rejected add retains exact selection and permits retry`,async()=>{const f=fixture(platform);f.uncheck(f.render());click(button(f.render(),'Add selected items'));await flush();assert.match(text(f.render()),/could not confirm.*selection is still here/);assert.deepEqual(Array.from(f.state.calls[0][2]),['oat']);assert.deepEqual(f.checked(f.render()),[false,true]);assert.equal(button(f.render(),'Add selected items').props.disabled,false);f.state.write=async()=>true;click(button(f.render(),'Add selected items'));await flush();assert.match(text(f.render()),/Selected groceries added/);assert.equal(button(f.render(),'Add selected items').props.disabled,true);});
 test(`${platform}: thrown add recovers without leaking private response text`,async()=>{const f=fixture(platform);f.state.write=async()=>{throw Error('private provider details');};click(button(f.render(),'Add selected items'));await flush();assert.match(text(f.render()),/could not confirm/);assert.doesNotMatch(text(f.render()),/private provider details|Selected groceries added/);assert.equal(button(f.render(),'Add selected items').props.disabled,false);});
 test(`${platform}: failed dismissal retains confirmation and selection`,async()=>{const f=fixture(platform);f.uncheck(f.render());click(button(f.render(),'Dismiss'));click(button(f.render(),'Dismiss this review'));await flush();assert.match(text(f.render()),/could not confirm/);assert.ok(button(f.render(),'Keep reviewing'));assert.deepEqual(f.checked(f.render()),[false,true]);assert.equal(f.state.calls[0][1],'dismiss');});
 test(`${platform}: successful dismissal never claims pantry addition`,async()=>{const f=fixture(platform);f.state.write=async()=>true;click(button(f.render(),'Dismiss'));click(button(f.render(),'Dismiss this review'));await flush();assert.match(text(f.render()),/No items were added/);assert.doesNotMatch(text(f.render()),/Selected groceries added/);assert.equal(button(f.render(),'Dismiss').props.disabled,true);});
 test(`${platform}: pending write disables choices and confirmation actions`,async()=>{const f=fixture(platform);let finish;f.state.write=()=>new Promise(resolve=>finish=resolve);click(button(f.render(),'Dismiss'));click(button(f.render(),'Dismiss this review'));assert.ok(nodes(f.render()).filter(n=>n.type==='Button').every(n=>n.props.disabled));finish(false);await flush();assert.equal(button(f.render(),'Keep reviewing').props.disabled,false);});
 test(`${platform}: empty selection cannot be added`,()=>{const f=fixture(platform);f.uncheck(f.render());const second=nodes(f.render()).filter(n=>platform==='Web'?n.type==='input':n.type==='Pressable')[1];platform==='Web'?second.props.onChange({target:{checked:false}}):second.props.onPress();assert.equal(button(f.render(),'Add selected items').props.disabled,true);assert.equal(button(f.render(),'Dismiss').props.disabled,false);});
}

test('Mobile: pending review actions expose busy semantics and clear them after settlement',async()=>{
 for(const action of ['accept','dismiss']){const f=fixture('Mobile');let finish;f.state.write=()=>new Promise(resolve=>finish=resolve);if(action==='dismiss'){click(button(f.render(),'Dismiss'));click(button(f.render(),'Dismiss this review'));}else click(button(f.render(),'Add selected items'));const pending=button(f.render(),action==='dismiss'?'Dismiss this review':'Saving review…');assert.equal(pending.props.busy,true);finish(false);await flush();assert.equal(button(f.render(),action==='dismiss'?'Dismiss this review':'Add selected items').props.busy,false);}
});
