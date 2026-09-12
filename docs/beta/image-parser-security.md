# Next image parser exposure review, 31 August 2026

Canonical checkout: `C:\Users\James\Documents\GitHub\SecondBreakfast`, branch
`codex/whimsical-private-beta`, base `dcb6f71`. This is an uncommitted local
mitigation, not a dependency patch or deployed fix. No sibling product was edited.

## Findings and change

The installed Next version is **15.5.23**. Its compiled `image-size/index.js` has
SHA-256 `f824c02fbd558131c8d433c04c245fa3a50f6120024d78485c9b69005e2e654e`.
The actual production `next-server.js.nft.json` includes that parser and
`server/image-optimizer.js`, both before and after this change.

The prior built configuration enabled the default optimizer and allowed every
HTTPS hostname. App middleware excludes Next internals; it is not an authorization
gate for `/_next/image`. The installed `NextNodeServer.handleNextImageRequest`
checks `images.unoptimized` before parameter validation, cache lookup and image
fetch/optimization. It still imports the optimizer module and constructs its cache
object before that check. This change is therefore not module elimination.

Only `apps/web/next.config.ts` changed among the prior 330 source/config files:
`images.unoptimized: true` closes that unused request path and `remotePatterns: []`
removes the wildcard allowance. These are supported Next settings; the official
[Image configuration documentation](https://nextjs.org/docs/app/api-reference/components/image#unoptimized)
describes the global unoptimized option. Installed-version handler tests establish
the early 404 behavior separately from the documentation.

Recipe, discovery, pantry, friend and avatar images already use browser `<img>`
URLs. The kitchen scene uses a public WebP URL; decorative art uses public CSS
assets. A TypeScript AST import audit found no app-owned web `next/image`,
`next/legacy/image`, `next/og`, Sharp, image-size or static image imports. No display
component, image URL, artwork, dietary data, care restriction or handoff changed.
The ordinary browser requests to recipe source hosts remain existing behavior;
this does not make those third-party images trusted or private.

The recipe import path fetches article text/JSON and stores the extracted image
URL; editing stores an image URL. No image upload, image-buffer decode or server
image proxy was found in the reviewed app API/import code. Open Graph recipe
metadata emits the URL without decoding it. The separate HTML/audio import
pipeline was not security-certified by this image review.

The raw parser failure is **not established as a production request exploit**.
In this installed version, `imageOptimizer` uses Sharp. Its `getImageSize` call
is restricted to a development blur placeholder after optimization. Other real
callers are `next-image-loader` and `next-metadata-image-loader` at build time.
The latter reads the two repository skillet icons. Static image support remains
enabled deliberately; disabling it blindly would not establish a parser fix.

## Bounded probe and verified result

`scripts/probe-next-image-parser.mjs --bounded` loads the installed parser in one
disposable worker at a time with an empty environment. Each worker has 32 MiB old
generation, 8 MiB young generation and 2 MiB stack limits, a five-second startup
deadline and a two-second parse deadline starting after module readiness. These
are isolate heap limits, not a total process RSS cap. Workers are terminated on
completion/error/deadline. No server request, external image or provider credential
is involved.

- The actual 608-byte skillet PNG returned 32 by 32 dimensions.
- A synthetic 16-byte ICNS zero-length chunk exhausted the worker after loading.
- A synthetic 36-byte JXL zero-length partial box exhausted its worker after loading.

Both malformed outcomes were `ERR_WORKER_OUT_OF_MEMORY`, within the deadline.
This confirms the residual local parser flaw, not successful remediation. The
[probe JSON](checks/image-security-parser-probe.json) preserves timings and limits.

| Check | Evidence |
| --- | --- |
| Eight focused checks passed | [boundary log](checks/image-security-boundary.txt): installed handler extracted by AST, real parameter validator, synthetic outer server/request/cache boundaries, no listening server or fetch |
| Baseline sensitivity and mitigation | Wildcard baseline reaches the deliberately stopped optimizer boundary; mitigated dev/production requests return 404 before validation; removing the wildcard independently rejects remote parameters |
| Four existing library contracts passed | [combined 12-test log](checks/image-security-web-regressions.txt), including legacy and illustrated image/fallback behavior |
| Ten regenerated offline/privacy tests passed | [offline log](checks/image-security-offline.txt) |
| Web TypeScript passed | [typecheck log](checks/image-security-web-typecheck.txt) |
| Production web build passed | [build log](checks/image-security-web-build.txt), 35 prerendered pages, care remains dynamic |
| Built config, trace, icons and preserved sources | [333-source/476-output manifest](checks/image-security-build-manifest.json) and `scripts/check-next-image-build.mjs` |

Current `.next-build` ID is **`JU_bSJRJvJgnvh6kH4QVX`**, replacing the local output
for historical ID `8SppsANVHSszqZHJ20R5P`. Prior logs and fingerprints remain intact;
[baseline evidence](checks/image-security-baseline.json) verified all 476 prior
output hashes before rebuilding. The build used direct Node, no package install,
blanked local configuration variables, production mode, beta/preview/checkout/live
billing off, no Clerk/database/paid API credentials, and service-worker compilation
on. It is not an account-enabled release image. Both built image manifests have
optimization disabled. Emitted icon route bodies are byte-identical to the PR #38
skillet files, and all image/component source hashes are unchanged.

Initial test harness runs failed because the synthetic server lacked Next's
experimental cache defaults/route-kind binding and the import walker did not guard
the AST root parent. Those harness defects were corrected; two failed logs are
retained as `checks/image-security-boundary-{initial-failure,fixture-failure}.txt`.
The build retained the existing large-string webpack cache warning and exited 0.

Repeat focused checks from the canonical repository, without pnpm:

```powershell
node --test scripts/check-next-image-boundary.mjs scripts/check-woodland-library.mjs
node scripts/probe-next-image-parser.mjs --bounded
node scripts/check-next-image-build.mjs
node apps/web/node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json
node --import ./packages/core/node_modules/tsx/dist/loader.mjs --test packages/core/test/offline-privacy.test.ts packages/core/test/offline-parity.test.ts
```

The build audit is intentionally pinned to this review checkpoint and APK hashes.
Future intended source changes require a new reviewed checkpoint, not relaxing its
assertions to make an unrelated revision appear verified.

## Remaining security and release gates

The parser bytes are unchanged and still reachable from trusted build metadata or
future static image imports. Keep source, build assets and dependency inputs under
review. A misleading filename is not validation: parser detection inspects bytes.
Do not build unreviewed image changes with provider credentials or a privileged
release role. The Docker context excludes local env/dependency/generated folders;
the existing release process still requires immutable reviewed source and build
provenance. There is no `.github` workflow directory in this checkout. No live
CodeBuild role, buildspec, source archive or deployed revision was inspected here.

Before release, the owner must review and commit the intended combined source,
build through the coordinated target, and verify candidate **and rollback** retain
this image configuration as well as privacy-v3 caching. Existing cache-policy
labels alone do not prove image-optimizer mitigation. Prefer a kill switch that
retains the hardened image; rolling back an older image could reopen the endpoint.
Company target/identity and provenance gates remain unchanged. No cloud retarget,
build upload, deployment, CI dispatch, push, merge, advisory suppression or live
billing change occurred.

A future supported dependency update must verify the bundled parser itself and
repeat the bounded probes; no parser-fix or advisory-closure claim is made now.
Permitted browser/real-account/device checks, owner visual acceptance, current
Wispling-alpha handoff, release signing and cohort enrollment remain open.

All **161 native source/config hashes and all three APK hashes** match the prior
checkpoint, including original, illustrated account and illustrated guest builds.
Billing code/config source and dependency/lockfile hashes are unchanged. No Android
build or extra billing/database run was needed. This pass made no browser retry,
device validation, invitation, paid job or external image fetch.
