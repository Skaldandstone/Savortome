import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import assert from 'node:assert/strict';
// Execute the actual CLI body with filesystem/process boundaries replaced.
const source=readFileSync(new URL('./write-beta-image-report.mjs',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'');
const image='574921529762.dkr.ecr.us-east-2.amazonaws.com/secondbreakfast-web@sha256:'+'a'.repeat(64);
const commit='d'.repeat(40);
function run(change={}){
  let output;const built={RepoDigests:[image],Config:{Labels:{'org.opencontainers.image.revision':commit,'com.secondbreakfast.public-cache-version':'3'},Env:['NEXT_PUBLIC_ENABLE_SW=true','NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_synthetic']},...change};
  runInNewContext(source,{process:{argv:['node','script',image],env:{SB_RELEASE_COMMIT:commit,CODEBUILD_BUILD_ID:'secondbreakfast-web-build:00000000-0000-0000-0000-000000000000',CODEBUILD_BUILD_SUCCEEDING:'1',CODEBUILD_SOURCE_VERSION:'object-version'}},createHash,execFileSync:(cmd,args)=>{assert.equal(cmd,'docker');assert.deepEqual(Array.from(args),['image','inspect',image]);return JSON.stringify([built]);},mkdirSync:()=>{},writeFileSync:(path,data)=>{assert.equal(path,'beta-artifacts/beta-image-report.json');output=data;},console:{log:()=>{}}});
  return output;
}
test('CodeBuild report writer emits actual inspected digest/revision/config without key values',()=>{
  const output=run();const report=JSON.parse(output);assert.equal(report.image,image);assert.equal(report.ociRevision,commit);assert.equal(report.publicCacheVersion,3);assert.equal(report.clerkPublishableKeySha256,createHash('sha256').update('pk_test_synthetic').digest('hex'));assert.equal(output.includes('pk_test'),false);
});
test('CodeBuild report writer refuses substituted image metadata',()=>{
  assert.throws(()=>run({RepoDigests:['other-digest']}),/mismatch/);
  assert.throws(()=>run({Config:{Labels:{'org.opencontainers.image.revision':commit,'com.secondbreakfast.public-cache-version':'1'},Env:['NEXT_PUBLIC_ENABLE_SW=true','NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_synthetic']}}),/mismatch/);
});
