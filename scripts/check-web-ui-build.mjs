// Validates the new frozen UI source and output without rewriting older reviews.
// No server, provider, browser, dependency or artifact mutation is performed.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFileSync(resolve(root, path));
const json = path => JSON.parse(read(path));
const fingerprint = path => ({ path, sha256: createHash('sha256').update(read(path)).digest('hex') });
const drift = entries => entries.filter(entry => !existsSync(resolve(root, entry.path))
  || fingerprint(entry.path).sha256 !== entry.sha256).map(entry => entry.path);
const frozen = json('docs/beta/checks/web-ui-integration-source.json');
assert.deepEqual(drift(frozen.source), [], 'source changed after the integration freeze');
const handoff = json(frozen.handoff.path);
assert.equal(fingerprint(frozen.handoff.path).sha256, frozen.handoff.sha256);
assert.equal(fingerprint(handoff.previousCheckpoint).sha256, handoff.previousCheckpointSha256);
assert.deepEqual(drift(handoff.preservation.protectedFiles), []);
assert.deepEqual(drift(handoff.preservation.androidArtifacts), []);
const native = json('docs/beta/checks/overnight-android-source-manifest.json');
assert.deepEqual(drift(native), []);

const buildRoot = 'apps/web/.next-build';
const built = json(`${buildRoot}/required-server-files.json`);
const images = json(`${buildRoot}/images-manifest.json`).images;
assert.equal(built.config.images.unoptimized, true);
assert.equal(images.unoptimized, true);
assert.deepEqual(built.config.images.remotePatterns, []);
assert.equal(built.config.images.disableStaticImages, false);
assert.equal(existsSync(resolve(root, 'apps/web/public/care-offline.html')), false);
const icons = ['icon.png', 'apple-icon.png'].map(name => {
  const source = fingerprint(`apps/web/app/${name}`);
  const output = fingerprint(`${buildRoot}/server/app/${name}.body`);
  assert.equal(source.sha256, output.sha256);
  return { source, output };
});
const trace = json(`${buildRoot}/next-server.js.nft.json`);
const parserTrace = trace.files.filter(path => path.endsWith('/compiled/image-size/index.js'));
assert.equal(parserTrace.length, 1, 'unchanged parser remains a documented risk');
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
  branch: frozen.branch, baseCommit: frozen.baseCommit,
  sourceState: 'uncommitted completed web UI plus reviewed profile-save follow-up',
  buildId: read(`${buildRoot}/BUILD_ID`).toString().trim(), previousBuildId: handoff.previousBuildId,
  configuration: frozen.configuration, handoff: frozen.handoff,
  integrationChanges: frozen.integrationChanges,
  preservation: { protectedFiles: handoff.preservation.protectedFiles.length,
    nativeSources: native.length, androidArtifacts: handoff.preservation.androidArtifacts, iconRoutes: icons },
  parser: { trace: parserTrace, status: 'unchanged; endpoint disabled, trusted build inputs still reach parser' },
  source: frozen.source, artifact,
  limits: ['not a hosted container or account-enabled build', 'no browser/device/visual owner acceptance',
    'no dependency parser fix', 'no paid integration enabled'] }, null, 2));
