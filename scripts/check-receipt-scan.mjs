import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);

async function routeFixture() {
  const built = await build({
    absWorkingDir: root,
    bundle: true,
    write: false,
    platform: "node",
    format: "iife",
    globalName: "route",
    stdin: { resolveDir: root, contents: `export * from './apps/web/app/api/pantry/intake/scan/route.ts';` },
    plugins: [{ name: "receipt-boundaries", setup(api) {
      const stubs = {
        "@seconds/core": `
          export const MAX_PHOTO_BASE64_CHARS=12000000,MAX_PHOTO_BYTES=9000000;
          export const isPhotoMediaType=value=>['image/jpeg','image/png','image/webp'].includes(value);
          export const extractReceiptPhoto=async()=>{state.modelCalls++;return {sourceLabel:'Corner market',items:[{displayName:'bananas',quantity:6,unit:null}]};};
          export const parsePantryIntake=value=>value;`,
        "@seconds/db": `
          export const createPantryIntake=async(_db,userId,value)=>{state.saved={userId,...value};return {id:'intake-1',...value};};
          export const listPendingPantryIntakes=async()=>[{id:'intake-1'}];`,
        "@/lib/api": `
          export class BadRequestError extends Error{};
          export const readJson=async request=>{state.bodyReads++;return request.body;};
          export const withUser=async handler=>{if(state.signedOut)return {status:401};try{return {status:200,body:await handler('user-a',{})};}catch(error){return {status:error.name==='NotConfiguredError'?501:400,error};}};`,
        "@/lib/session": `export class NotConfiguredError extends Error{constructor(message){super(message);this.name='NotConfiguredError';}};`,
      };
      api.onResolve({ filter: /.*/ }, args => Object.hasOwn(stubs, args.path) ? { path: args.path, namespace: "stub" } : undefined);
      api.onLoad({ filter: /.*/, namespace: "stub" }, args => ({ contents: stubs[args.path], loader: "js" }));
    }}],
  });
  const state = { signedOut: false, bodyReads: 0, modelCalls: 0, saved: null };
  const context = { state, process: { env: {} }, Buffer, require };
  runInNewContext(built.outputFiles[0].text, context);
  return { state, env: context.process.env, route: context.route };
}

test("receipt route authenticates before reading the body or calling the model", async () => {
  const fixture = await routeFixture();
  fixture.state.signedOut = true;
  const response = await fixture.route.POST({ body: { imageBase64: "bad" } });
  assert.equal(response.status, 401);
  assert.equal(fixture.state.bodyReads, 0);
  assert.equal(fixture.state.modelCalls, 0);
});

test("receipt route fails closed unless the metered feature is explicitly configured", async () => {
  const fixture = await routeFixture();
  const response = await fixture.route.POST({ body: {} });
  assert.equal(response.status, 501);
  assert.equal(fixture.state.bodyReads, 0);
  assert.equal(fixture.state.modelCalls, 0);
});

test("receipt route stores only normalized review data and a duplicate digest", async () => {
  const fixture = await routeFixture();
  fixture.env.RECEIPT_SCAN_ENABLED = "true";
  fixture.env.ANTHROPIC_API_KEY = "test-placeholder";
  const response = await fixture.route.POST({ body: { imageBase64: "aW1hZ2U=", imageMediaType: "image/jpeg" } });
  assert.equal(response.status, 200);
  assert.equal(fixture.state.modelCalls, 1);
  assert.equal(fixture.state.saved.userId, "user-a");
  assert.equal(fixture.state.saved.source, "receipt");
  assert.equal(fixture.state.saved.acquiredAt, null);
  assert.match(fixture.state.saved.externalReference, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(fixture.state.saved).includes("aW1hZ2U="), false);
  assert.deepEqual(JSON.parse(JSON.stringify(fixture.state.saved.items)), [{ displayName: "bananas", quantity: 6, unit: null }]);
});

test("receipt mobile source requests camera permission only from the camera action and keeps review explicit", async () => {
  const source = await readFile(root + "apps/mobile/modules/pantry/ReceiptCapture.tsx", "utf8");
  assert.match(source, /source === "camera"[\s\S]*requestCameraPermissionsAsync/);
  assert.match(source, /Nothing was added to your pantry yet/);
  assert.match(source, /onScan\(asset\.base64, mediaType\)/);
  assert.doesNotMatch(source, /requestMediaLibraryPermissionsAsync/);
});
