# Privacy and release readiness evidence

Recorded 30 August 2026 against the shared uncommitted beta source. This lane did not mutate the shared test database, deploy, contact testers or use live payment/grocery credentials. Integration must rerun the combined checks after final edits and record the reviewed commit and artifact digests.

| Evidence | Result | What it proves |
| --- | --- | --- |
| [Release script mocks](checks/release-mocks.txt) | 56 assertions pass | Actual PowerShell release script with strict in-process AWS/Docker fixtures; identity, source/digest/OCI/config checks, exact cohort, rollback privacy, packet and service drift, stable capacity, preservation of roles/secrets/tags/network, failed rollout, kill switch |
| [Authorization boundary mocks](checks/authorization-mocks.txt) | 7 tests pass | Actual server gate and care page with synthetic Clerk/Next/React boundaries; disabled default, invited/non-invited, forged queries, sanitized sign-in return, absent config, auth failure, production/local distinction |
| [Offline/privacy/grocery checks](checks/privacy-offline-grocery.txt) | 37 tests pass | 8 worker VM tests, 2 generated parity/source checks, 27 grocery helper/local-stub tests; no production database or purchase |
| [Image report writer mocks](checks/image-report-mocks.txt) | 2 tests pass | Actual report CLI body with Docker/filesystem boundaries replaced; no key values in report, substituted image metadata rejected |
| [Final authorization/report rerun](checks/authorization-report-final.txt) | 9 tests pass | Both suites repeated after native dependency installation; direct Node, no package changes |
| Offline bundle generation | Passed after care/data declared final ranker stable | Generated `care-offline.js` matches current shared ranking for six strict-choice combinations; generated worker contains audited source |
| Online offline-document URL | HTTP 404 at fresh loopback harness 3097 | No public static HTML entry; unit test also verifies an installed worker preserves online 404 instead of returning its synthetic cached document |
| Fresh v3 browser install/update | Passed through web lane | Visible harness reported `seconds-public-v3`, removal of seeded legacy cache, synthetic A/B/signed-out/API/write checks, controller change and repeated checks; [capture](web-worker-v3-update.jpg) |
| Fresh v3 browser offline fallback | Passed through web lane | Failed `/care` navigation rendered current applesauce/banana/apple ideas; open + warm returned no match without relaxing restrictions; [offline capture](web-worker-v3-offline.jpg), [no-match capture](web-worker-v3-no-match.jpg) |
| Earlier browser evidence | Retained | `offline-cache-update.txt` and `offline-shell.txt` describe an earlier worker. They must not be substituted for final v3 results |
| Full core/data validation | See care/data report; integration later reports 551 core tests passing | Earlier care/data run had 540 tests; 15 disposable DB suites/335 assertions and 10 transaction/account-isolation scenarios. Counts reflect their respective source snapshots |
| Four typechecks / integrated care UI | Integration reports all four typechecks and 12 care UI tests passing | Final combined production web build remains integration-owned; source checks do not establish live Clerk, device or visual correctness |
| AWS identity/revision/rollback/schedule | Blocked | Existing profile was expired; no current deployed digest, build provenance, suitable rollback image or actual scale-down state was read |
| CodeBuild report path | Mocked only | Candidate AND rollback can be verified without local Docker. No trusted live report exists yet; existing project/bucket permissions and versioning are unverified |
| Android / Wispling | See dedicated reports | Source/helper/prebuild evidence is separate from APK signing, OS dispatch, emulator and physical-device checks |

## Worker privacy boundary

Audited source is `apps/web/modules/offline/worker.js`; `scripts/build-care-offline.mjs` generates the public worker and catalogue bundle during web prebuild. There is deliberately no `public/care-offline.html`. The worker constructs an account-independent HTML Response from a generated literal and stores it under a virtual cache key. Normal online navigation always uses the server response, including 404 or denied care. Only a rejected network navigation uses the generic document. Static JS and art remain public source assets, not protected data.

The public cache accepts exact generic bundle/icon paths, Next static JS/CSS/fonts, and named woodland raster assets. It excludes queries, other origins, authorization-bearing requests, mutations, APIs and application HTML. Precache fetches omit credentials. Redirected, private/no-store, unsuccessful, opaque, cookie/auth-varying and wrong-content-type responses cannot enter the cache. Activation removes known legacy Second Breakfast caches and retains unrelated origin caches. A cache quota failure must not turn a successfully fetched live asset into a failed request.

Offline fallback is not authorization and is not an account-specific entitlement. A previously installed worker can keep generic local ideas after logout or cohort revocation; it cannot retrieve private data or write a list offline. A kill switch cannot remotely erase an installed APK or its local public catalogue. Online server access remains authoritative. Do not promise immediate revocation inside an already rendered page.

Generated artifacts at this handoff: `sw.js` SHA256 `db6ec08b5a561d37b8faaac5c000daa6579c5df2fe6a826be05a9ed07785d6e4`; `care-offline.js` SHA256 `20f10448571dc53d293f573294f3c2ebc25a02994ab24bea0f50f756cf5e20cd`. These are local source artifacts, not a deployed image digest. Prebuild must regenerate them if catalogue/worker source changes.

The browser harness uses synthetic account labels, no real Clerk sessions, and a deliberately failed `/care` network navigation. It does not prove airplane mode, actual Clerk logout/account switching, browser back-forward cache behavior or session expiry. Those checks remain required with disposable real sessions. This lane's browser connection timed out twice; fresh successful v3 checks were performed by the web lane and identified as such.

After that v3 pass, the web lane's canonical development app reload was blocked by browser URL security policy with an explicit instruction not to retry or use alternate surfaces. No workaround was attempted. Remaining post-fix form/plans screenshots are pending; this later limit does not invalidate the earlier v3 harness evidence. Integration's later AWS STS recheck still reported an expired session.

## Release blockers and review gates

1. Renew AWS authentication in the existing profile, verify account `574921529762`/region `us-east-2`, running task definition/digests, CodeBuild source/config, deployment circuit breaker and existing scale-down arrangement. HTTP 200 is not revision evidence.
2. Establish a reviewed privacy-hardened previous image. A pre-beta image with broad response caching is unsuitable for either manual rollback or ECS automatic rollback. A separate privacy-only bridge release may be needed before beta activation. None was deployed here.
3. Review and commit the combined source, run the final tests/typechecks/web build and Android build/export, record image/APK hashes and approved signing. A debug-keystore APK is local review only.
4. Exercise actual invited/non-invited/signed-out sessions, sign-in restoration, account switching/logout, expired settings reads and failed/ambiguous writes on web and Android. Verify no private cache entries and no false saved message. Mocks are not live Clerk integration evidence.
5. Complete available Android emulator/physical-device interaction and both-direction Wispling launch/absence/onboarding/return checks. Physical testing remains separate. Resolve required keyboard, enlarged text, TalkBack/screen-reader, themes and reduced-decoration inspection against final builds.
6. Verify test integration configuration. Stripe lane commit `27642cad8f8153a1bae30fbfae1a7f7494cd8ec0` is parent-reviewed integration work; see [Stripe setup](../STRIPE_SETUP.md). Keep checkout and live mode false for the free beta. Existing sandbox identity/catalog remain unverified. Grocery tests use a loopback stand-in, not a live cart. Do not enable unavailable integrations to obtain a passing screenshot.
7. Record usability/safety approval and a named manual feedback destination, then obtain the cohort's Clerk IDs privately. No identities are required for development and no invitation is sent automatically.

## Repeatable local commands

Run in PowerShell from the canonical repository; no AWS executable is used by the mocked release tests.

```powershell
node scripts/build-care-offline.mjs
powershell.exe -NoProfile -File scripts/check-beta-release.ps1
node --test scripts/check-beta-authorization.mjs scripts/check-beta-image-report.mjs
pnpm --filter @seconds/core exec node --import tsx --test test/offline-privacy.test.ts test/offline-parity.test.ts test/carts-kroger.test.ts
```

For fresh browser worker QA, set `$env:CARE_HARNESS_PORT='3097'`, run `node scripts/care-offline-harness.mjs`, then open `http://localhost:3097/qa`. Use Install, Update, and Test offline navigation. Verify `/care-offline.html` returns 404 both before and after install; temporary open/warm choices should yield no match. The server binds loopback and is never mounted in the application. Use a fresh port/origin for an independent first-install test.
