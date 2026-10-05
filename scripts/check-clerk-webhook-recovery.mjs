// Actual route with synthetic signature, DB, Stripe and photo-store boundaries.
// No real signature delivery, account deletion, cancellation or storage request.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {build} from 'esbuild';
const mocks={
 'next/server':`export const NextResponse={json:(body,options)=>({body,status:options?.status??200})};`,
 '@clerk/nextjs/webhooks':`export const verifyWebhook=async request=>{state.calls.push('verify');state.verifiedRequest=request;return state.verify();};`,
 '@seconds/db':`export const db=()=>{state.calls.push('db');return state.database();};export const findUserForDeletion=async(_db,id)=>{state.calls.push('find:'+id);return state.find(id);};export const deleteUserById=async(_db,id)=>{state.calls.push('delete:'+id);return state.remove(id);};export const upsertUserFromClerk=async(_db,value)=>{state.calls.push('upsert');return state.upsert(value);};`,
 '@/lib/r2':`export const deleteRecipePhotos=async photos=>{state.calls.push('photos');return state.photos(photos);};`,
 '@/lib/stripe':`export const stripeConfigured=()=>state.billing;export const stripe=()=>({subscriptions:{retrieve:async id=>{state.calls.push('retrieve:'+id);return state.retrieve(id);},cancel:async id=>{state.calls.push('cancel:'+id);return state.cancel(id);}}});`,
 'server-only':``,
 './session.js':`export class NotConfiguredError extends Error{}`,
 '@aws-sdk/client-s3':`export class DeleteObjectCommand{constructor(input){this.input=input;}};export class PutObjectCommand{};export class S3Client{send(command){state.calls.push('object:'+command.input.Key);return state.sendResponse();}};`,
 stripe:`class MissingResource extends Error{};export default class Stripe{static errors={StripeInvalidRequestError:MissingResource};}`,
};
async function bundleRoute(actualPhotos=false){return build({platform:'node',bundle:true,write:false,format:'iife',globalName:'app',stdin:{resolveDir:process.cwd(),contents:`export {POST} from './apps/web/app/api/webhooks/clerk/route.ts';`},plugins:[{name:'webhook-boundaries',setup(api){api.onResolve({filter:/.*/},args=>actualPhotos&&args.path==='@/lib/r2'?{path:process.cwd()+'/apps/web/lib/r2.ts'}:Object.hasOwn(mocks,args.path)?{path:args.path,namespace:'mock'}:undefined);api.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:mocks[args.path],loader:'js'}));}}]});}
const bundle=await bundleRoute();
const photoBundle=await bundleRoute(true);
function fixture(actualPhotos=false){
 const state={calls:[],billing:false,event:{type:'user.deleted',data:{id:'fixture-clerk'}},user:{id:'fixture-owner',stripeSubscriptionId:null}};
 state.verify=async()=>state.event;state.database=()=>({});state.find=async()=>state.user;
 state.remove=async()=>({photos:[{key:'fixture/photo'}]});state.photos=async()=>{};state.upsert=async()=>{};
 state.retrieve=async()=>({status:'active'});state.cancel=async()=>{};
 const context={state,process:{env:{CLERK_WEBHOOK_SIGNING_SECRET:'synthetic-not-a-real-secret'}}};if(actualPhotos)Object.assign(context.process.env,{R2_ACCOUNT_ID:'synthetic',R2_ACCESS_KEY_ID:'synthetic',R2_SECRET_ACCESS_KEY:'synthetic',R2_BUCKET_NAME:'synthetic',R2_PUBLIC_URL_BASE:'https://fixture.invalid'});
 runInNewContext((actualPhotos?photoBundle:bundle).outputFiles[0].text,context);
 state.failure=runInNewContext("() => { throw new Error('private provider/database diagnostic'); }",context);
 state.sendResponse=state.failure;
 const request={fixture:true};return{state,context,request,post:()=>context.app.POST(request)};
}
const genericFailure=response=>{assert.equal(response.status,500);assert.deepEqual(JSON.parse(JSON.stringify(response.body)),{error:'Webhook handling failed.'});};
test('Clerk route: missing config does not verify or touch data',async()=>{const f=fixture();delete f.context.process.env.CLERK_WEBHOOK_SIGNING_SECRET;assert.equal((await f.post()).status,501);assert.deepEqual(f.state.calls,[]);});
test('Clerk route: failed signature is generic and never opens database',async()=>{const f=fixture();f.state.verify=f.state.failure;const response=await f.post();assert.equal(response.status,400);assert.equal(response.body.error,'Invalid signature.');assert.deepEqual(f.state.calls,['verify']);});
test('Clerk route: database setup failure returns a generic retryable response',async()=>{const f=fixture();f.state.database=f.state.failure;genericFailure(await f.post());assert.deepEqual(f.state.calls,['verify','db']);});
test('Clerk route: failed user write withholds private details',async()=>{const f=fixture();f.state.event={type:'user.updated',data:{id:'fixture-clerk',email_addresses:[],first_name:null,last_name:null,username:null,image_url:null,primary_email_address_id:null}};f.state.upsert=f.state.failure;genericFailure(await f.post());assert.deepEqual(f.state.calls,['verify','db','upsert']);});
test('Clerk route: billing lookup failure precedes account and photo deletion',async()=>{const f=fixture();f.state.billing=true;f.state.user.stripeSubscriptionId='fixture-sub';f.state.retrieve=f.state.failure;genericFailure(await f.post());assert.deepEqual(f.state.calls,['verify','db','find:fixture-clerk','retrieve:fixture-sub']);});
test('Clerk route: failed cancellation cannot delete account',async()=>{const f=fixture();f.state.billing=true;f.state.user.stripeSubscriptionId='fixture-sub';f.state.cancel=f.state.failure;genericFailure(await f.post());assert.deepEqual(f.state.calls,['verify','db','find:fixture-clerk','retrieve:fixture-sub','cancel:fixture-sub']);});
test('Clerk route: failed account deletion cannot clean photos or claim success',async()=>{const f=fixture();f.state.remove=f.state.failure;genericFailure(await f.post());assert.deepEqual(f.state.calls,['verify','db','find:fixture-clerk','delete:fixture-owner']);});
test('Clerk route: failed photo cleanup remains generic and retryable',async()=>{const f=fixture();f.state.photos=f.state.failure;genericFailure(await f.post());assert.deepEqual(f.state.calls,['verify','db','find:fixture-clerk','delete:fixture-owner','photos']);});
test('Clerk route: verified deletion follows billing/account/photo order',async()=>{const f=fixture();f.state.billing=true;f.state.user.stripeSubscriptionId='fixture-sub';let received;f.state.photos=async value=>{received=value;};assert.equal((await f.post()).status,200);assert.equal(f.state.verifiedRequest,f.request);assert.deepEqual(f.state.calls,['verify','db','find:fixture-clerk','retrieve:fixture-sub','cancel:fixture-sub','delete:fixture-owner','photos']);assert.deepEqual(JSON.parse(JSON.stringify(received)),[{key:'fixture/photo'}]);});
test('Clerk route: already-cancelled subscription is not cancelled twice',async()=>{const f=fixture();f.state.billing=true;f.state.user.stripeSubscriptionId='fixture-sub';f.state.retrieve=async()=>({status:'canceled'});assert.equal((await f.post()).status,200);assert.ok(!f.state.calls.some(value=>value.startsWith('cancel:')));});
test('Clerk route: unknown event and missing deleted ID cause no account or provider actions',async()=>{for(const event of [{type:'session.created',data:{}},{type:'user.deleted',data:{}}]){const f=fixture();f.state.event=event;assert.equal((await f.post()).status,200);assert.deepEqual(f.state.calls,['verify','db']);}});
test('Clerk route: absent account acknowledges without photo or billing action',async()=>{const f=fixture();f.state.find=async()=>null;assert.equal((await f.post()).status,200);assert.deepEqual(f.state.calls,['verify','db','find:fixture-clerk']);});

test('Clerk route: stored subscription with unavailable billing must retain account for retry',async()=>{const f=fixture();f.state.user.stripeSubscriptionId='fixture-sub';genericFailure(await f.post());assert.deepEqual(f.state.calls,['verify','db','find:fixture-clerk']);});
test('Known open gap: actual photo helper suppresses storage failure and retry loses descriptors',async()=>{const f=fixture(true);f.state.remove=async()=>{f.state.user=null;return {photos:[{key:'fixture/photo'}]};};assert.equal((await f.post()).status,200);assert.deepEqual(f.state.calls,['verify','db','find:fixture-clerk','delete:fixture-owner','object:fixture/photo']);f.state.calls.length=0;assert.equal((await f.post()).status,200);assert.deepEqual(f.state.calls,['verify','db','find:fixture-clerk']);});
