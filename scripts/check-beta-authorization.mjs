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
  const sandbox={state,URL,URLSearchParams,process:{env:{NODE_ENV:'production',SB_BETA_ENABLED:'true',SB_PUBLIC_ACCESS:'true',SB_BETA_CLERK_USER_IDS:'user_invited',SB_BETA_LOCAL_PREVIEW:'true',...envOverrides}}};
  runInNewContext(result.outputFiles[0].text,sandbox);
  return {state,run:params=>sandbox.tested.page({searchParams:Promise.resolve(params??{})}),access:()=>sandbox.tested.canUseBeta()};
}
test('disabled server gate ignores invited identity and frontend flags without reading auth',async()=>{
  const f=fixture({userId:'user_invited'},{SB_BETA_ENABLED:'false',NEXT_PUBLIC_BETA:'true'});assert.equal(await f.access(),false);assert.equal(f.state.authCalls,0);assert.equal(f.state.userCalls,0);await assert.rejects(f.run(),/NOT_FOUND/);
});
test('public guest receives only validated handoff fields without an auth read',async()=>{
  const f=fixture();const output=await f.run({source:'wispling',return_to:'wispling://care-return',effort:'open',diagnosis:'private',userId:'user_invited',completed:'true'});
  assert.equal(output.props.link.return_to,'wispling://care-return');assert.equal(output.props.link.effort,'open');assert.equal(output.props.link.diagnosis,undefined);assert.equal(output.props.link.userId,undefined);assert.equal(output.props.link.completed,undefined);
  assert.equal(f.state.authCalls,0);assert.equal(f.state.userCalls,0);
});
test('non-invited user cannot forge access or redirect through query fields',async()=>{
  const f=fixture({userId:'user_other'},{SB_PUBLIC_ACCESS:'false'});await assert.rejects(f.run({userId:'user_invited',return_to:'https://evil.test',SB_BETA_ENABLED:'true'}),/NOT_FOUND/);
});
test('invited user receives only validated care props; arbitrary return rejected',async()=>{
  const f=fixture({userId:'user_invited'},{SB_PUBLIC_ACCESS:'false'});const output=await f.run({source:'wispling',temperature:'warm',return_to:'https://evil.test',food:'private'});
  assert.equal(output.props.link.temperature,'warm');assert.equal(output.props.link.return_to,undefined);assert.equal(output.props.link.food,undefined);
  assert.equal(f.state.userCalls,0);
});
test('Studio-approved Clerk metadata grants beta access without a static user-ID entry',async()=>{
  const f=fixture({userId:'user_requested',publicMetadata:{studio_access:{savortome:{approved:true,request_id:'request_1'}}}},{SB_PUBLIC_ACCESS:'false',SB_BETA_CLERK_USER_IDS:''});
  assert.equal(await f.access(),true);assert.equal(f.state.authCalls,1);assert.equal(f.state.userCalls,1);
});
test('historical Second Breakfast approval metadata remains readable during migration',async()=>{
  const f=fixture({userId:'user_legacy',publicMetadata:{studio_access:{'second-breakfast':{approved:true}}}},{SB_PUBLIC_ACCESS:'false',SB_BETA_CLERK_USER_IDS:''});
  assert.equal(await f.access(),true);
});
test('unapproved, wrong-product, and mismatched Clerk users fail closed',async()=>{
  for(const publicMetadata of [{},{studio_access:{savortome:{approved:false}}},{studio_access:{vordling:{approved:true}}}]){
    const f=fixture({userId:'user_requested',publicMetadata},{SB_PUBLIC_ACCESS:'false',SB_BETA_CLERK_USER_IDS:''});assert.equal(await f.access(),false);
  }
  const mismatch=fixture({userId:'user_requested',returnedUserId:'user_other',publicMetadata:{studio_access:{savortome:{approved:true}}}},{SB_PUBLIC_ACCESS:'false',SB_BETA_CLERK_USER_IDS:''});assert.equal(await mismatch.access(),false);
  const unavailable=fixture({userId:'user_requested',userError:true},{SB_PUBLIC_ACCESS:'false',SB_BETA_CLERK_USER_IDS:''});assert.equal(await unavailable.access(),false);
});
test('public Care works without Clerk while a closed production beta still fails closed',async()=>{
  const publicCare=fixture({configured:false});assert.ok((await publicCare.run()).props.link);assert.equal(publicCare.state.authCalls,0);assert.equal(publicCare.state.userCalls,0);
  const closed=fixture({configured:false},{SB_PUBLIC_ACCESS:'false'});await assert.rejects(closed.run(),/NOT_FOUND/);assert.equal(closed.state.authCalls,0);assert.equal(closed.state.userCalls,0);
});
test('local development preview remains usable without an account',async()=>{
  const f=fixture({configured:false},{NODE_ENV:'development'});assert.ok((await f.run()).props.link);
});
test('closed beta fails closed when auth is unavailable or expired',async()=>{
  const f=fixture({authError:true,userId:'user_invited'},{SB_PUBLIC_ACCESS:'false'});await assert.rejects(f.run(),/session unavailable/);
  const expired=fixture({userId:null},{SB_PUBLIC_ACCESS:'false'});await assert.rejects(expired.run(),/NOT_FOUND/);
});
test('non-beta navigation points prospective users to the Savortome product page',()=>{
  const layout=readFileSync(new URL('../apps/web/app/layout.tsx',import.meta.url),'utf8');
  assert.match(layout,/href="https:\/\/skaldandstone\.com\/savortome\/">About Savortome<\/a>/);
  assert.doesNotMatch(layout,/skaldandstone\.com\/vordling/);
  assert.doesNotMatch(layout,/@skaldandstone\.com/);
});
