import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
const bundle = await build({ bundle:true, write:false, platform:'node', format:'iife', globalName:'app', jsx:'automatic',
  stdin:{resolveDir:process.cwd(),contents:`export { AuthGate } from './apps/mobile/modules/account/AuthGate.tsx';`},
  plugins:[{name:'account-boundaries',setup(api){
    const mocks={
      react:`export const useState=initial=>{const i=state.cursor++;if(!(i in state.values))state.values[i]=initial;return [state.values[i],v=>state.values[i]=v];};export const useEffect=fn=>state.effects.push(fn);`,
      'react/jsx-runtime':`export const Fragment='Fragment';export const jsx=(type,props)=>typeof type==='function'?type(props):({type,props});export const jsxs=jsx;`,
      'react-native':`export const View='View',Text='Text',ActivityIndicator='ActivityIndicator';export const StyleSheet={create:v=>v};`,
      'expo-router':`export const Link='Link';`,
      'expo-updates':`export const reloadAsync=()=>{state.reloads++;return state.reload();};`,
      '@clerk/expo':`export const useAuth=()=>state.auth;`,
      '@/lib/sentry':`export const reportAccountFailure=code=>state.reports.push(code);`,
      '@/ui':`export const usePalette=()=>({bg:'#191e1b',text:'#eddfc5',textMuted:'#c0af92',accent:'#e1ba7d'});export const Button='Button';`,
    };
    api.onResolve({filter:/.*/},args=>{
      if(args.path==='./SignInScreen')return {path:'SignInScreen',namespace:'mock'};
      if(Object.hasOwn(mocks,args.path))return {path:args.path,namespace:'mock'};
    });
    api.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:args.path==='SignInScreen'?`export const SignInScreen=()=>({type:'SignInScreen',props:{}});`:mocks[args.path],loader:'js'}));
  }}],
});
function fixture(auth={isLoaded:false,isSignedIn:undefined}) {
  const state={auth,cursor:0,values:[],effects:[],reloads:0,reload:async()=>{},timers:[],reports:[]};
  const context={state,process:{env:{EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY:'public-fixture'}},setTimeout:fn=>{state.timers.push(fn);return fn;},clearTimeout:fn=>state.timers=state.timers.filter(x=>x!==fn)};
  runInNewContext(bundle.outputFiles[0].text,context);
  const render=()=>{state.cursor=0;return context.app.AuthGate({children:'PRIVATE RECIPES'});};
  return {state,render};
}
function nodes(tree){return Array.isArray(tree)?tree.flatMap(nodes):tree&&typeof tree==='object'?[tree,...nodes(tree.props?.children)]:[];}
function text(tree){if(Array.isArray(tree))return tree.map(text).join(' ');if(tree&&typeof tree==='object')return text(tree.props?.children);return String(tree??'');}
test('unresolved account immediately shows loading and a guest link, never private recipes',()=>{
  const f=fixture(),tree=f.render();assert.match(text(tree),/account is still loading/);assert.doesNotMatch(text(tree),/PRIVATE RECIPES/);assert.ok(nodes(tree).some(n=>n.type==='Link'&&n.props.href==='/care'));
});
test('account stalled or failed for 12 seconds has recovery, without unlocking private routes',()=>{
  const f=fixture();f.render();f.state.effects.forEach(fn=>fn());f.state.timers.forEach(fn=>fn());const tree=f.render();assert.match(text(tree),/couldn’t load your account/);assert.doesNotMatch(text(tree),/PRIVATE RECIPES/);assert.ok(nodes(tree).some(n=>n.type==='Link'&&n.props.href==='/care'));
});
test('late successful account recovery leaves timeout screen and returns signed-in content',()=>{
  const f=fixture();f.render();f.state.effects.forEach(fn=>fn());f.state.timers.forEach(fn=>fn());f.state.auth={isLoaded:true,isSignedIn:true};assert.equal(f.render(),'PRIVATE RECIPES');
});
test('loaded signed-out users receive sign-in rather than private content',()=>{
  assert.equal(fixture({isLoaded:true,isSignedIn:false}).render().type,'SignInScreen');
});
test('retry reload failure is actionable and does not leave a busy button forever',async()=>{
  const f=fixture();f.render();f.state.effects.forEach(fn=>fn());f.state.timers.forEach(fn=>fn());f.state.reload=async()=>{throw new Error('fixture unavailable');};const tree=f.render();nodes(tree).find(n=>n.type==='Button').props.onPress();await new Promise(resolve=>setImmediate(resolve));assert.equal(f.state.reloads,1);const next=f.render();assert.match(text(next),/close and reopen/);assert.equal(nodes(next).find(n=>n.type==='Button').props.disabled,false);
});
