import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import { readFile } from 'node:fs/promises';
const built=await build({entryPoints:['apps/mobile/lib/sentryPrivacy.ts'],bundle:true,write:false,platform:'node',format:'iife',globalName:'privacy'});
const context={};runInNewContext(built.outputFiles[0].text,context);
const scrub=context.privacy.scrubMobileEvent;
test('drops food, identity, navigation and request content even from exception text and stack locals',()=>{
  const secret='PRIVATE_BANANAS_TOKEN_email@example.invalid';
  const event={type:undefined,event_id:'0123456789abcdef0123456789abcdef',release:'com.skaldandstone.savortome@0.1.4',extra:{pantry:secret},user:{email:secret},request:{headers:{authorization:secret},data:secret,url:`https://example.invalid/care?texture=${secret}`},contexts:{state:secret},breadcrumbs:[{message:secret}],message:secret,tags:{account:secret},exception:{values:[{type:'TypeError',value:secret,stacktrace:{frames:[{filename:'app:///index.android.bundle?token='+secret,lineno:7,colno:11,vars:{receipt:secret},context_line:secret}]}}]}};
  const clean=scrub(event);assert.ok(!JSON.stringify(clean).includes(secret));assert.equal(clean.exception.values[0].type,'TypeError');assert.equal(clean.exception.values[0].stacktrace.frames[0].lineno,7);assert.equal(clean.release,event.release);
});
test('only fixed diagnostic codes survive and attachments are removed',()=>{
  const hint={attachments:[{data:'RECEIPT_IMAGE'}]};const clean=scrub({tags:{diagnostic_code:'hosted-auth-failed',account:'private'},exception:{values:[{type:'ServerSecret',value:'private'}]}},hint);
  assert.equal(hint.attachments.length,0);assert.equal(clean.tags.diagnostic_code,'hosted-auth-failed');assert.equal(clean.exception.values[0].value,'hosted-auth-failed');assert.equal(clean.exception.values[0].type,'Error');
  assert.equal(scrub({tags:{diagnostic_code:'private-food'}}).tags.diagnostic_code,undefined);
});
test('debug IDs survive without private file paths',()=>{
  const clean=scrub({debug_meta:{images:[{type:'sourcemap',debug_id:'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',code_file:'https://private.invalid/users/alice/index.android.bundle?secret=x'}]}});
  assert.equal(clean.debug_meta.images[0].debug_id,'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');assert.equal(clean.debug_meta.images[0].code_file,'index.android.bundle');
});
test('native startup and JS handlers initialize with errors-only privacy settings',async()=>{
  const native=await readFile('apps/mobile/plugins/SavortomeSentry.kt.template','utf8');const js=await readFile('apps/mobile/lib/sentry.ts','utf8');const pkg=JSON.parse(await readFile('apps/mobile/package.json','utf8'));
  assert.equal(pkg.main,'index.js');assert.match(native,/setBeforeSend/);assert.match(native,/hint.clearAttachments/);assert.match(native,/val clean = SentryEvent\(\)/);assert.match(native,/setEnableNdk\(false\)/);assert.match(js,/beforeSend:scrubMobileEvent/);assert.match(js,/replaysOnErrorSampleRate:0/);assert.match(js,/attachScreenshot:false/);assert.match(js,/enableAutoSessionTracking:false/);
});
