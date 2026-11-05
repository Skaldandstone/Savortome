// Actual shopping-list hook; synthetic React, browser and client boundaries.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';
const mocks={
 react:`export const useCallback=fn=>fn;export const useState=v=>{const i=state.cursor++;if(!(i in state.values))state.values[i]=v;return[state.values[i],v=>{state.writes++;state.values[i]=typeof v==='function'?v(state.values[i]):v;}];};export const useRef=v=>state.values[state.cursor++]??={current:v};export const useEffect=(fn,deps)=>{const i=state.cursor++;if(!state.deps[i]||deps.some((v,n)=>v!==state.deps[i][n])){state.deps[i]=deps;state.effects.push(()=>{state.cleanups[i]?.();state.cleanups[i]=fn();});}};`,
 'react/jsx-runtime':`export const Fragment='Fragment';export const jsx=(type,props)=>({type,props});export const jsxs=jsx;`,
 '@/lib/action-failure':`export const actionFailure=(err,message)=>({message:err instanceof Error?err.message:message,signInRequired:false});`,
 '@/ui':`export const Button='Button';`,
 'next/navigation':`export const useRouter=()=>({push:path=>state.routes.push(path)});`,
 '@seconds/core/format':`export {isUuid} from './packages/core/src/ids.ts';`,
 '@/lib/client':`export const api={getList:()=>state.read(),cartProviders:async()=>[],setListItemChecked:(...args)=>{state.calls.push(['toggle',...args]);return state.save();},removeListItem:id=>{state.calls.push(['remove',id]);return state.save();},clearList:()=>{state.calls.push(['clear']);return state.save();},addRecipesToList:ids=>{state.calls.push(['recipes',ids]);return state.save();},addItemsToList:items=>{state.calls.push(['items',items]);return state.save();},sendToCart:provider=>{state.calls.push(['cart',provider]);return state.cart();}};`,
};
const bundle=await build({bundle:true,write:false,format:'iife',globalName:'app',jsx:'automatic',stdin:{resolveDir:process.cwd(),contents:"export {useShoppingList} from './apps/web/modules/list/useShoppingList.ts'; export {api} from '@/lib/client';"},plugins:[{name:'web-recipe-shopping',setup(api){api.onResolve({filter:/.*/},args=>Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'mock'}:undefined);api.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js',resolveDir:process.cwd()}));}}]});

const initial={id:'10000000-0000-4000-8000-000000000001',itemCount:1,checkedCount:0,items:[{id:'10000000-0000-4000-8000-000000000002',canonicalItem:'tomato',displayName:'tomato',quantity:null,unit:null,checked:false,recipeIds:[]}]};
const flush=async()=>{for(let n=0;n<15;n++)await Promise.resolve();};
function fixture(){
 const state={writes:0,cursor:0,values:[],deps:[],cleanups:[],effects:[],calls:[]};state.read=async()=>initial;state.save=async()=>initial;
 state.cart=async()=>({provider:'clipboard',kind:'handoff',text:'tomato',url:'',unmatched:[],note:'List ready.'});state.clipboard=[];state.windows=[];
 const context={state,URL,navigator:{clipboard:{writeText:text=>{state.clipboard.push(text);return state.copy?.()??Promise.resolve();}}},window:{open:(...args)=>state.windows.push(args)}};runInNewContext(bundle.outputFiles[0].text,context);
 let client=context.app.api;const render=(effects=true)=>{state.cursor=0;const result=context.app.useShoppingList(client);if(effects)while(state.effects.length)state.effects.shift()();return result;};
 render();return{state,render,replaceClient:()=>{client={...context.app.api};},unmount:()=>state.cleanups.forEach(fn=>fn?.())};
}
test('pending different list actions dispatch only once',async()=>{
 const f=fixture();await flush();let finish;f.state.save=()=>new Promise(resolve=>finish=resolve);const c=f.render();
 const first=c.toggle(initial.items[0].id,true),second=c.clear();assert.equal(f.state.calls.length,1);
 assert.equal(f.render().list.items[0].checked,false);finish({...initial,checkedCount:1,items:[{...initial.items[0],checked:true}]});await Promise.all([first,second]);assert.equal(f.render().list.checkedCount,1);
});
test('retained actions and late writes after unmount do not dispatch or update',async()=>{
 const f=fixture();await flush();let finish;f.state.save=()=>new Promise(resolve=>finish=resolve);const c=f.render();
 const pending=c.remove(initial.items[0].id);f.unmount();const writes=f.state.writes;finish(initial);await pending;
 assert.equal(f.state.writes,writes);await c.clear();assert.equal(f.state.calls.length,1);
});
test('list refresh blocks mutation dispatch until its read settles',async()=>{
 const f=fixture();await flush();let finishRead;f.state.read=()=>new Promise(resolve=>finishRead=resolve);f.render().retryList();const c=f.render();
 await c.clear();finishRead(initial);await flush();assert.equal(f.render().list.itemCount,1); // refresh must block dispatch while reading
 assert.equal(f.state.calls.length,0);
});
test('failed checkbox save preserves confirmed state and warns of uncertainty',async()=>{
 const f=fixture();await flush();f.state.save=async()=>{throw Error('private failure');};await f.render().toggle(initial.items[0].id,false);
 assert.equal(f.render().list.items[0].checked,false);assert.match(f.render().error.message,/unconfirmed|may still finish/i);assert.doesNotMatch(f.render().error.message,/private failure/);
});

test('provider handoff shares the mutation lock and blocks list refresh',async()=>{
 const f=fixture();await flush();let finish;f.state.cart=()=>new Promise(resolve=>finish=resolve);
 const c=f.render(),pending=c.sendToCart('clipboard');await c.clear();c.retryList();f.render();assert.equal(f.state.calls.length,1);
 finish({provider:'clipboard',kind:'handoff',text:'tomato',url:'',unmatched:[],note:'List ready.'});await pending;assert.equal(f.state.clipboard.length,1);assert.equal(f.render().busy,false);
});
test('provider response after unmount cannot copy, navigate or update',async()=>{
 const f=fixture();await flush();let finish;f.state.cart=()=>new Promise(resolve=>finish=resolve);
 const c=f.render(),pending=c.sendToCart('clipboard');f.unmount();const writes=f.state.writes;
 finish({provider:'doordash',kind:'handoff',text:'tomato',url:'https://www.doordash.com/convenience/',unmatched:[],note:'List ready.'});await pending;
 assert.equal(f.state.writes,writes);assert.equal(f.state.clipboard.length,0);assert.equal(f.state.windows.length,0);await c.sendToCart('clipboard');assert.equal(f.state.calls.length,1);
});
test('unmount during clipboard wait suppresses subsequent navigation',async()=>{
 const f=fixture();await flush();let finish;f.state.copy=()=>new Promise(resolve=>finish=resolve);
 f.state.cart=async()=>({provider:'doordash',kind:'handoff',text:'tomato',url:'https://www.doordash.com/convenience/',unmatched:[],note:'List ready.'});
 const pending=f.render().sendToCart('doordash');await flush();assert.equal(f.state.clipboard.length,1);f.unmount();const writes=f.state.writes;
 finish();await pending;assert.equal(f.state.windows.length,0);assert.equal(f.state.writes,writes);
});
test('malformed write retains prior confirmed list and reports uncertainty',async()=>{
 for(const result of [null,{}, {...initial,itemCount:8},{...initial,checkedCount:1},{...initial,items:[{}]}]){
 const f=fixture();await flush();f.state.save=async()=>result;await f.render().clear();assert.equal(f.render().list.itemCount,1);assert.match(f.render().error.message,/unconfirmed/i);}
});
test('failed read blocks retained writes until deliberate successful refresh',async()=>{
 const f=fixture();await flush();f.state.read=async()=>{throw Error('fixture unavailable');};f.render().retryList();f.render();await flush();
 await f.render().clear();assert.equal(f.state.calls.length,0);assert.equal(f.render().busy,true);
 f.state.read=async()=>initial;f.render().retryList();f.render();await flush();await f.render().clear();assert.equal(f.state.calls.length,1);
});
test('rejected provider does not expose private transport detail',async()=>{
 const f=fixture();await flush();f.state.cart=async()=>{throw Error('private provider detail');};await f.render().sendToCart('clipboard');
 assert.doesNotMatch(f.render().error.message,/private provider detail/);assert.equal(f.render().busy,false);assert.equal(f.state.windows.length,0);
});

test('replacement client immediately hides old private data and blocks retained writes before cleanup',async()=>{
 const f=fixture();await flush();const old=f.render();f.replaceClient();const next=f.render(false);
 assert.equal(next.list,null);assert.equal(next.loaded,false);await old.clear();assert.equal(f.state.calls.length,0);
 f.render();await flush();assert.equal(f.render().loaded,true);
});
test('pending old write cannot confirm into replacement scope before effect cleanup',async()=>{
 const f=fixture();await flush();let finish;f.state.save=()=>new Promise(resolve=>finish=resolve);
 const pending=f.render().clear();f.replaceClient();f.render(false);const writes=f.state.writes;
 finish({...initial,itemCount:0,checkedCount:0,items:[]});await pending;assert.equal(f.state.writes,writes);assert.equal(f.render(false).list,null);
});
test('pending old provider cannot copy or navigate after scope replacement',async()=>{
 const f=fixture();await flush();let finish;f.state.cart=()=>new Promise(resolve=>finish=resolve);
 const pending=f.render().sendToCart('clipboard');f.replaceClient();f.render(false);
 finish({provider:'copy',text:'private list',url:'https://example.invalid/review'});await pending;
 assert.equal(f.state.clipboard.length,0);assert.equal(f.state.windows.length,0);
});

test('older settlement cannot unlock a replacement-scope pending write',async()=>{
 const f=fixture();await flush();let finishOld;f.state.save=()=>new Promise(resolve=>finishOld=resolve);const old=f.render().clear();
 f.replaceClient();f.render();await flush();let finishNew;f.state.save=()=>new Promise(resolve=>finishNew=resolve);const current=f.render().clear();
 finishOld(initial);await old;await f.render().remove(initial.items[0].id);assert.equal(f.state.calls.length,2);assert.equal(f.render().busy,true);
 finishNew(initial);await current;
});
test('replacement read failure hides prior data but exposes recoverable error',async()=>{
 const f=fixture();await flush();f.replaceClient();f.state.read=async()=>{throw Error('fixture failure');};f.render();await flush();
 assert.equal(f.render().list,null);assert.equal(f.render().loaded,false);assert.ok(f.render().listError);assert.equal(f.render().loading,false);
});

test('replacement actions cannot dispatch before replacement read begins',async()=>{
 const f=fixture();await flush();f.replaceClient();const next=f.render(false);await next.clear();await next.sendToCart('clipboard');assert.equal(f.state.calls.length,0);
});

const handoff={provider:'doordash',kind:'handoff',text:'tomato',url:'https://www.doordash.com/convenience/',unmatched:[],note:'List ready.'};
test('invalid handoff cannot copy, navigate, or publish a success notice',async()=>{
 const bad=[null,{}, {...handoff,provider:'safeway'},{...handoff,kind:'api'},{...handoff,text:[]},{...handoff,unmatched:[42]},{...handoff,note:null},
 ...['javascript:alert(1)','data:text/html,hello','/relative','http://www.doordash.com/convenience/','https://www.doordash.com.evil.invalid/convenience/','https://user@www.doordash.com/convenience/','https://www.doordash.com:8443/convenience/','https://www.doordash.com/other'].map(url=>({...handoff,url}))];
 for(const result of bad){const f=fixture();await flush();f.state.cart=async()=>result;await f.render().sendToCart('doordash');assert.equal(f.state.clipboard.length,0);assert.equal(f.state.windows.length,0);assert.equal(f.render().handoff,null);assert.ok(f.render().error);assert.equal(f.render().busy,false);}
});
test('valid store handoff copies and opens only its confirmed destination',async()=>{
 const f=fixture();await flush();f.state.cart=async()=>handoff;await f.render().sendToCart('doordash');assert.equal(f.state.clipboard.length,1);assert.equal(f.state.windows[0][0],handoff.url);assert.equal(f.state.windows[0][2],'noopener,noreferrer');
});
test('failed new handoff clears the previous success notice',async()=>{
 const f=fixture();await flush();await f.render().sendToCart('clipboard');assert.ok(f.render().handoff);f.state.cart=async()=>{throw Error('fixture unavailable');};await f.render().sendToCart('clipboard');assert.equal(f.render().handoff,null);assert.ok(f.render().error);
});

test('configured provider destinations admit HTTPS only and reject domain impersonation',async()=>{
 const cases=[['instacart','api','https://www.instacart.com/store/shopping_lists/example'],['kroger','api','https://www.kroger.com/cart'],['ubereats','handoff','https://www.ubereats.com/category/grocery'],['safeway','handoff','https://www.safeway.com/shop/search-results.html?q=tomato%20sauce']];
 for(const [provider,kind,url] of cases){const f=fixture();await flush();f.state.cart=async()=>({...handoff,provider,kind,url});await f.render().sendToCart(provider);assert.equal(f.state.windows.length,1);assert.equal(f.state.clipboard.length,1);assert.equal(f.render().error,null);}
 for(const url of ['https://instacart.com.evil.invalid/list','https://evilinstacart.com/list','https://user:password@www.instacart.com/list','javascript:alert(1)','https://www.instacart.com:8443/list','https://www.instacart.com/list#fragment','https://www.instacart.com/\\evil.invalid',' https://www.instacart.com/list']){const f=fixture();await flush();f.state.cart=async()=>({...handoff,provider:'instacart',kind:'api',url});await f.render().sendToCart('instacart');assert.equal(f.state.windows.length,0);assert.equal(f.state.clipboard.length,0);assert.ok(f.render().error);}
});
