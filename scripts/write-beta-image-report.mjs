// Run inside the existing trusted CodeBuild job after push/pull by digest.
// Never exports Clerk keys or runtime secrets. The AWS artifact checksum binds
// these inspected facts to that build; a loose JSON file is not release proof.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
const image = process.argv[2];
const commit = process.env.SB_RELEASE_COMMIT;
if (!/^051722405355\.dkr\.ecr\.us-east-2\.amazonaws\.com\/[a-z0-9/_-]+@sha256:[a-f0-9]{64}$/.test(image ?? '')) throw Error('Expected immutable existing ECR image.');
if (!/^[a-f0-9]{40}$/.test(commit ?? '') || !/^secondbreakfast-web-build:[a-f0-9-]{36}$/.test(process.env.CODEBUILD_BUILD_ID ?? '') || process.env.CODEBUILD_BUILD_SUCCEEDING !== '1') throw Error('Expected reviewed commit and successful trusted CodeBuild context.');
const [built, ...extra] = JSON.parse(execFileSync('docker', ['image', 'inspect', image], { encoding: 'utf8' }));
const keys = built?.Config?.Env?.filter(value => /^NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_(test|live)_.+/.test(value)) ?? [];
if (extra.length || !built?.RepoDigests?.includes(image) || built?.Config?.Labels?.['org.opencontainers.image.revision'] !== commit || built.Config.Labels['com.secondbreakfast.public-cache-version'] !== '3' || !built.Config.Env.includes('NEXT_PUBLIC_ENABLE_SW=true') || keys.length !== 1) throw Error('Image digest, revision, privacy policy or build configuration mismatch.');
mkdirSync('beta-artifacts', { recursive: true });
writeFileSync('beta-artifacts/beta-image-report.json', JSON.stringify({
  schemaVersion: 1, codeBuildId: process.env.CODEBUILD_BUILD_ID,
  sourceVersion: process.env.CODEBUILD_SOURCE_VERSION,
  image, ociRevision: commit, serviceWorkerBuilt: true, publicCacheVersion: 3,
  clerkPublishableKeySha256: createHash('sha256').update(keys[0].slice(keys[0].indexOf('=') + 1)).digest('hex'),
}, null, 2) + '\n');
console.log('Wrote digest-bound image report without key values.');
