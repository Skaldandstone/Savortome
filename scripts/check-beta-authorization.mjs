// Real page + server gate, with synthetic Clerk/React/Next boundaries. No DB.
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const result=await build({absWorkingDir:root,stdin:{contents:"export {default as page} from './apps/web/app/care/page.tsx'; export {canUseBeta} from './apps/web/lib/beta.ts';",resolveDir:root},bundle:true,write:false,platform:'node',format:'iife',globalName:'tested',jsx:'automatic',plugins:[{name:'synthetic-boundaries',setup(api){
  const stubs={
    'server-only':'',
    'react':'export const cache = fn => fn;',
    'react/jsx-runtime':'export const jsx = (type, props) => ({type,props}); export const jsxs = jsx;',
    '@clerk/nextjs/server':'export const auth = async () => { state.authCalls++; if(state.authError) throw Error("session unavailable"); return {userId:state.userId}; }; export const currentUser = async () => { state.userCalls++; if(state.userError) throw Error("user unavailable"); return state.userId ? {id:state.returnedUserId ?? state.userId,publicMetadata:state.publicMetadata ?? {}} : null; };',
    'next/navigation':'export const notFound = () => { throw Error("NOT_FOUND"); }; export const redirect = path => { throw Error("REDIRECT:"+path); };',
    '@/modules/care/CareScreen':'export const CareScreen = () => null;',
  };
  api.onResolve({filter:/.*/},args=>{
    if(Object.hasOwn(stubs,args.path))return {path:args.path,namespace:'fixture'};
    if(args.path==='@/lib/beta')return {path:root+'apps/web/lib/beta.ts'};
    if(args.path==='@/lib/session'||(args.path==='./session'&&/[\\/]beta\.ts$/.test(args.importer)))return {path:'session',namespace:'fixture'};
  });
  api.onLoad({filter:/.*/,namespace:'fixture'},args=>({contents:args.path==='session'?'export const clerkConfigured = () => state.configured;':stubs[args.path],loader:'js'}));
}}]});
function fixture(overrides={}, envOverrides={}) {
  const state={configured:true,userId:null,authCalls:0,userCalls:0,...overrides};
  const sandbox={state,URL,URLSearchParams,process:{env:{NODE_ENV:'production',SB_BETA_ENABLED:'true',SB_BETA_CLERK_USER_IDS:'user_invited',SB_BETA_LOCAL_PREVIEW:'true',...envOverrides}}};
  runInNewContext(result.outputFiles[0].text,sandbox);
  return {state,run:params=>sandbox.tested.page({searchParams:Promise.resolve(params??{})}),access:()=>sandbox.tested.canUseBeta()};
}
test('disabled server gate ignores invited identity and frontend flags without reading auth',async()=>{
  const f=fixture({userId:'user_invited'},{SB_BETA_ENABLED:'false',NEXT_PUBLIC_BETA:'true'});assert.equal(await f.access(),false);assert.equal(f.state.authCalls,0);assert.equal(f.state.userCalls,0);await assert.rejects(f.run(),/NOT_FOUND/);
});
test('signed-out redirect contains only validated handoff fields',async()=>{
  const f=fixture();let message='';try{await f.run({source:'wispling',return_to:'wispling://care-return',effort:'open',diagnosis:'private',userId:'user_invited',completed:'true'});}catch(e){message=e.message;}
  assert.ok(message.startsWith('REDIRECT:/sign-in?'));const target=new URL('https://test'+message.slice(9));const care=new URL(target.searchParams.get('redirect_url'),'https://test');
  assert.equal(care.pathname,'/care');assert.equal(care.searchParams.get('return_to'),'wispling://care-return');assert.equal(care.searchParams.has('diagnosis'),false);assert.equal(care.searchParams.has('userId'),false);assert.equal(care.searchParams.has('completed'),false);
});
test('non-invited user cannot forge access or redirect through query fields',async()=>{
  const f=fixture({userId:'user_other'});await assert.rejects(f.run({userId:'user_invited',return_to:'https://evil.test',SB_BETA_ENABLED:'true'}),/NOT_FOUND/);
});
test('invited user receives only validated care props; arbitrary return rejected',async()=>{
  const f=fixture({userId:'user_invited'});const output=await f.run({source:'wispling',temperature:'warm',return_to:'https://evil.test',food:'private'});
  assert.equal(output.props.link.temperature,'warm');assert.equal(output.props.link.return_to,undefined);assert.equal(output.props.link.food,undefined);
  assert.equal(f.state.userCalls,0);
});
test('Studio-approved Clerk metadata grants beta access without a static user-ID entry',async()=>{
  const f=fixture({userId:'user_requested',publicMetadata:{studio_access:{'second-breakfast':{approved:true,request_id:'request_1'}}}},{SB_BETA_CLERK_USER_IDS:''});
  assert.equal(await f.access(),true);assert.equal(f.state.authCalls,1);assert.equal(f.state.userCalls,1);
});
test('unapproved, wrong-product, and mismatched Clerk users fail closed',async()=>{
  for(const publicMetadata of [{},{studio_access:{'second-breakfast':{approved:false}}},{studio_access:{tomte:{approved:true}}}]){
    const f=fixture({userId:'user_requested',publicMetadata},{SB_BETA_CLERK_USER_IDS:''});assert.equal(await f.access(),false);
  }
  const mismatch=fixture({userId:'user_requested',returnedUserId:'user_other',publicMetadata:{studio_access:{'second-breakfast':{approved:true}}}},{SB_BETA_CLERK_USER_IDS:''});assert.equal(await mismatch.access(),false);
  const unavailable=fixture({userId:'user_requested',userError:true},{SB_BETA_CLERK_USER_IDS:''});assert.equal(await unavailable.access(),false);
});
test('missing Clerk configuration cannot enable local preview in production',async()=>{
  const f=fixture({configured:false});await assert.rejects(f.run(),/NOT_FOUND/);assert.equal(f.state.authCalls,0);assert.equal(f.state.userCalls,0);
});
test('local development preview remains usable without an account',async()=>{
  const f=fixture({configured:false},{NODE_ENV:'development'});assert.ok((await f.run()).props.link);
});
test('unavailable/expired auth fails closed and never renders care',async()=>{
  const f=fixture({authError:true,userId:'user_invited'});await assert.rejects(f.run(),/session unavailable/);
  const expired=fixture({userId:null});await assert.rejects(expired.run(),/REDIRECT:\/sign-in/);
});
test('non-beta navigation points prospective users to the product-scoped Studio request form',()=>{
  const layout=readFileSync(new URL('../apps/web/app/layout.tsx',import.meta.url),'utf8');
  assert.match(layout,/href="https:\/\/skaldandstone\.com\/secondbreakfast\/#request-access">Request beta access<\/a>/);
  assert.doesNotMatch(layout,/@skaldandstone\.com/);
});
