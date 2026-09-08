// Post-build evidence for this scoped review; no server, provider calls or writes.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const require = createRequire(resolve(root, 'apps/web/package.json'));
const read = path => readFileSync(resolve(root, path));
const json = path => JSON.parse(read(path));
const hash = path => createHash('sha256').update(read(path)).digest('hex');
const fingerprint = path => ({ path, sha256: hash(path) });
const prior = json('docs/beta/checks/overnight-review-manifest.json');
const native = json('docs/beta/checks/overnight-android-source-manifest.json');
const drift = entries => entries.filter(entry => !existsSync(resolve(root, entry.path))
  || hash(entry.path) !== entry.sha256).map(entry => entry.path);
const sourceDrift = drift(prior.source);
assert.deepEqual(sourceDrift, ['apps/web/next.config.ts'], 'only the reviewed runtime config may change');
assert.deepEqual(drift(native), [], 'native source/config must remain frozen');
const artifacts = [
  ['apps/mobile/.expo-export/account-preview/second-breakfast-arm64-review.apk', 'b828dcf86cbba709d0fc1905a38e5cf1495cb8acd789e4c2357aae0fe4d82957'],
  ['apps/mobile/.expo-export/account-preview/second-breakfast-arm64-woodland-review.apk', '1677bb302e8e9a7054df391182a9b6517d181c74ca2160b75b792a8d09f201cf'],
  ['apps/mobile/.expo-export/guest-preview/second-breakfast-arm64-woodland-guest.apk', '9dda3582dbb846c00ca29f57805f60114417bd6fb9b94cb0ade31e68ee719293'],
].map(([path, expected]) => { const entry = fingerprint(path); assert.equal(entry.sha256, expected); return entry; });
const buildRoot = 'apps/web/.next-build';
const files = json(`${buildRoot}/required-server-files.json`);
const images = json(`${buildRoot}/images-manifest.json`).images;
assert.equal(files.config.images.unoptimized, true);
assert.equal(images.unoptimized, true);
assert.deepEqual(files.config.images.remotePatterns, []);
assert.equal(files.config.images.disableStaticImages, false);
const icons = ['icon.png', 'apple-icon.png'].map(name => {
  const source = fingerprint(`apps/web/app/${name}`);
  const emitted = fingerprint(`${buildRoot}/server/app/${name}.body`);
  assert.equal(source.sha256, emitted.sha256, 'metadata route must preserve icon bytes');
  return { source, emitted };
});
const trace = json(`${buildRoot}/next-server.js.nft.json`);
const parserTrace = trace.files.filter(path => path.endsWith('/compiled/image-size/index.js'));
assert.equal(parserTrace.length, 1, 'review parser presence honestly, not an elimination claim');
const source = [...prior.source.map(entry => fingerprint(entry.path)),
  ...['scripts/check-next-image-boundary.mjs', 'scripts/probe-next-image-parser.mjs',
    'scripts/check-next-image-build.mjs'].map(fingerprint)];
const artifact = [];
function scan(dir) {
  for (const entry of readdirSync(resolve(root, dir), { withFileTypes: true })) {
    if (entry.name === 'cache') continue;
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) scan(path);
    else artifact.push(fingerprint(path));
  }
}
scan(buildRoot);
console.log(JSON.stringify({ schemaVersion: 1, recordedAt: new Date().toISOString(),
  baseCommit: prior.baseCommit, branch: prior.branch, sourceState: 'uncommitted scoped image endpoint mitigation',
  previousBuildId: prior.buildId, buildId: read(`${buildRoot}/BUILD_ID`).toString().trim(),
  configuration: { ...prior.configuration, imageOptimizerEnabled: false, staticImageImportsEnabled: true },
  nextVersion: require('next/package.json').version,
  parser: { sha256: hash(relative(root, require.resolve('next/dist/compiled/image-size'))), trace: parserTrace,
    remainingRisk: 'Unchanged parser; trusted metadata/static build inputs still reach it. No raw production parser exploit established.' },
  preservation: { priorSourceCount: prior.source.length, sourceDrift, unchangedNativeSourceCount: native.length,
    androidArtifacts: artifacts, iconRoutes: icons },
  source, artifact,
  limits: ['handler harness, not hosted HTTP validation', 'no browser visual or device acceptance',
    'not a parser patch', 'keyless local build, not a deployed or invited-account container'] }, null, 2));
