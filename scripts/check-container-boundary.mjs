import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const dockerfile = readFileSync(new URL('../Dockerfile.web', import.meta.url), 'utf8');
const runtime = dockerfile.slice(dockerfile.lastIndexOf('\nFROM '));
const runtimeInstructions = runtime.replace(/^\s*#.*$/gm, '');

test('web runtime is nonroot distroless and starts Next without a shell or package manager', () => {
  assert.match(runtime, /^\nFROM gcr\.io\/distroless\/nodejs22-debian12:nonroot AS runtime/m);
  assert.match(runtime, /CMD \["apps\/web\/node_modules\/next\/dist\/bin\/next", "start", "apps\/web"\]/);
  assert.doesNotMatch(runtimeInstructions, /\b(?:apt-get|curl|pnpm|corepack|sh|bash)\b/);
});

test('runtime preserves reviewed revision, public cache, worker and Clerk metadata', () => {
  assert.match(runtime, /org\.opencontainers\.image\.revision=\$SB_RELEASE_COMMIT/);
  assert.match(runtime, /com\.secondbreakfast\.public-cache-version="3"/);
  assert.match(runtime, /NEXT_PUBLIC_ENABLE_SW=\$NEXT_PUBLIC_ENABLE_SW/);
  assert.match(runtime, /NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=\$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY/);
});

test('optional media binaries are absent and RDS trust is copied from the build stage', () => {
  assert.doesNotMatch(runtime, /ffmpeg|yt-dlp|YT_DLP_PATH|FFMPEG_PATH/);
  assert.match(dockerfile, /fetch\('https:\/\/truststore\.pki\.rds\.amazonaws\.com\/global\/global-bundle\.pem'\)/);
  assert.match(runtime, /COPY --from=build --chown=nonroot:nonroot \/tmp\/rds-global-bundle\.pem \/etc\/ssl\/rds-global-bundle\.pem/);
  assert.match(runtime, /NODE_EXTRA_CA_CERTS=\/etc\/ssl\/rds-global-bundle\.pem/);
});

test('container health check uses the distroless Node binary', () => {
  assert.match(runtime, /HEALTHCHECK[\s\S]*CMD \["\/nodejs\/bin\/node", "-e"/);
});
