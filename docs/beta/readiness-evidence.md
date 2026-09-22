# Privacy and release readiness evidence

> **Physical Android refresh, 22 September 2026:** the connected Samsung
> SM-T970 had the exact retained Savortome APK installed, verified by pulling
> the installed package and matching its SHA-256 byte for byte. Guest Care
> passed a cold direct-link launch, exact ingredient and step expansion, honest
> signed-out shopping behavior, a Wi-Fi-off cold launch, malformed-link privacy,
> light and dark themes, 150% system text and zero animation scales. Network,
> theme, font and animation settings were restored. The captured log contained
> no fatal Android or React Native match. Signed-in writes, receipt capture and
> TalkBack traversal remain open and are not inferred from this pass. See
> [physical-device-evidence.md](physical-device-evidence.md).

> **Pantry input-recovery continuation, 22 September 2026:** the local
> candidate keeps typed pantry additions and remaining-amount corrections when
> a write is rejected, clears them only after server confirmation, and keeps
> bulk-clear context open after failure. Pending controls use explicit labels
> and block duplicate submissions without disabling unrelated pantry choices.
> Twenty-nine woodland UI contracts and the direct web typecheck pass. This is
> local source evidence only; signed-in browser and provider acceptance remain
> open, and no infrastructure, database, billing, grocery-order, or deployment
> mutation occurred.

> **Session-recovery continuation, 22 September 2026:** after PR #99 merged,
> a second local candidate added consistent expired-session recovery to the
> recipe editor, plan, pantry, pantry search, and shopping list. Sign-in links
> accept only app-local return paths; the meal plan preserves a validated week.
> Rejected shopping-list checkbox writes now roll the optimistic state back.
> Twelve focused care, recovery, session, and list-state tests, all four
> workspace typechecks, 27 woodland UI contracts, 10 web legal contracts, and
> the web production build pass locally. The production hostname remained in
> its documented overnight 503 sleep window, so authenticated browser
> acceptance is still open. No AWS, provider, billing, grocery-order, database,
> or deployment mutation occurred.

> **Neurodivergent-first web usability checkpoint, 22 September 2026:** the
> local candidate adds per-account tab-scoped recipe draft recovery, explicit
> confirmation before clearing a whole week, pantry, or shopping list, truthful
> unsaved-change error copy, and an expanded public accessibility explanation.
> Seven focused care/recovery tests, all four workspace typechecks, the web
> production build, 688 core tests, 27 woodland UI contracts, and 10 web legal,
> focus, and Clerk contracts pass. Signed-out wide and narrow production checks
> were completed before the overnight scale-down window. At 00:03 Pacific, the
> hostname returned the documented asleep 503 and ECS showed desired/running
> count 0/0 on candidate revision 25. The immutable web digest and cache-policy
> version 3 were rechecked read-only; no AWS resource changed. Authenticated
> browser acceptance remains open because the Chrome bridge stopped returning
> page state despite a running browser and correct native-host registration.
> This candidate is not deployed. See
> [neurodivergent-usability-audit.md](neurodivergent-usability-audit.md).

> **Current device and guest-Care checkpoint, 21 September 2026:** the live
> AWS service is healthy at desired/running count 1 in account `051722405355`,
> region `us-east-2`, with public access enabled and Stripe checkout/live mode
> disabled. The candidate in this working branch makes `/care` useful while
> signed out, without reading profile or pantry APIs and without allowing a
> shopping write. The web production build, all four workspace typechecks, 688
> core tests, 15 Playwright route tests, and 58 focused checks pass. A current
> debug-signed ARM64 APK passed the physical Samsung tablet checks recorded in
> [physical-device-evidence.md](physical-device-evidence.md). Browser checks at
> 200% text in both themes found no horizontal overflow and retained keyboard
> focus visibility. The Clerk new-device security email now matches the
> checked-in Savortome template. PR #96 was merged and the sealed image was
> deployed as task definition revision 25. ECS stabilized with the exact
> candidate digest and a healthy target. Signed-out live probes and a fresh
> service-worker browser run passed; see
> [public-launch.md](public-launch.md). TalkBack traversal,
> signed-in device flows, camera/gallery receipt capture, email-client visual
> acceptance, and grocery-provider integration remain separate open evidence.

> **Current open-beta checkpoint, 13 September 2026:** AWS account
> `051722405355`, profile `skaldandstone-admin`, region `us-east-2` is the sole
> verified target. The runtime stack is `UPDATE_COMPLETE`; ECS service
> `secondbreakfast-web` points at candidate revision 17 and is intentionally
> scaled to zero between midnight and 09:00 America/Los_Angeles. The immutable
> deployed image has a complete, zero-finding BASIC ECR scan. The public-access
> and beta flags are on, while Stripe checkout and live mode remain off and no
> Stripe secret is mapped into the task. The Savortome hostname returned the
> documented asleep 503 during this window. See
> [stripe-integration-evidence.md](stripe-integration-evidence.md) for the new
> exact-origin billing request boundary and local validation. Older account and
> "no runtime exists" statements below are retained as historical evidence and
> are superseded by this checkpoint and [public-launch.md](public-launch.md).

> **Current account and admission correction, 7 September 2026:** AWS account
> `051722405355` is the only target for new work. Studio invite requests require
> James's approval, recorded as product-scoped Clerk metadata and enforced by the
> app server. No email-domain rule is allowed. The candidate image exists and has
> a zero-finding BASIC scan in the current account; rollback, same-account build
> provenance, runtime, secrets and network controls remain open. See
> [account-admission-migration.md](account-admission-migration.md). Older account
> numbers below are historical evidence, not current instructions.

Latest reviewed checkpoint: [final-integration-checkpoint.md](final-integration-checkpoint.md).
It records the immutable privacy-v3 source package, current development account,
hardened x86_64 and arm64 Android artifacts, active-alpha Wispling patch, final
local checks and the remaining runtime acceptance gates. Where this older report
names account `574921529762` as the release target or calls the current-alpha
handoff unimplemented, the final checkpoint supersedes it.

The current AWS checkpoint is account `734702670689`, profile
`skaldandstone-dev`, region `us-east-2`. CodeBuild produced the undeployed
distroless image
`sha256:bfb6f728aac3f545db1616e8ea50e232234bdd6337b0198cdb64fcd302cbb5ff`
with config digest
`sha256:1336c885918997d652f9fa49dc8b6cd6187743a78f351fb0cc65a96168ddb452`
from source manifest
`6aeb5d28a68bf33f88ce8904013d38ee570c35b472c9b9c1eaf9b6b1347c2920`.
ECR BASIC scanning completed with zero
findings at all severities. Amazon Inspector enhanced ECR scanning is disabled,
so no enhanced or full-coverage scan is claimed. The saved CodeBuild project is
placeholder-only, and no Second Breakfast ECS service, ALB, DNS record or
endpoint exists.

The subsequent [accessibility continuation](accessibility-continuation.md)
passes 37 combined rendered/security checks, a 94-file accessibility source
audit, web TypeScript, ten offline privacy/parity checks and production build
`GRhfwCcQhEsHyFoXqVJvT`. It is sealed as source manifest
`f9db46eab22bbecbb1e2405640cd255e3d57c705af8601ba675f1bd3594fe693`.
That web-only source was superseded by the combined web and mobile source below.

The later [mobile accessibility continuation](mobile-accessibility-continuation.md)
passes a 67-file native source audit, 11 mobile UI/privacy contracts, mobile
TypeScript and a full ARM64 guest build. Its debug-signed review APK is
`f823846a9a531d6278603e22949559b309c18d7c9c81c507fb1d91f87f8c79cc`.
Static package inspection passed, but no device, TalkBack, visual, account or
cohort acceptance is inferred.

The combined accessibility source is now sealed as manifest
`6aeb5d28a68bf33f88ce8904013d38ee570c35b472c9b9c1eaf9b6b1347c2920`
and archive SHA-256
`0d274519adef66872f41bba1c610080c45d618f37e0f9a2966b9cd4527a897d0`.
Independent verification matched its 594 entries, snapshot commit and source
tree. CodeBuild
`skaldandstone-development-foundation-secondbreakfast-web:cc44acc1-edf2-4e04-bca8-2b953208b44e`
built the exact private image recorded above. It remains undeployed and has no
runtime endpoint.

Latest daytime UI integration: [web-ui-integration.md](web-ui-integration.md), build
`RHF3PnWQrDsVQJjkCCXDQ`, supersedes prior web source/build counts. The remaining
screen work and a profile-save race fix pass 48 focused checks, web TypeScript
and production build. Security configuration, billing and all Android artifacts
remain unchanged. Permitted browser, real-account, device and owner visual
acceptance remain open; no hosted readiness is inferred.

31 August image-security follow-up: [image-parser-security.md](image-parser-security.md)
records a web-only endpoint reduction, 12 focused handler/library checks, ten
offline checks, TypeScript and build success. That checkpoint's build was
`JU_bSJRJvJgnvh6kH4QVX`. Tiny malformed ICNS/JXL inputs still exhaust bounded parser
workers; no dependency-fix or production exploit claim is made. Candidate and
rollback review must preserve the disabled optimizer as well as privacy-v3 caching.
Android artifacts, billing source, account/device/visual and release gates remain unchanged.

31 August integration continuation: [overnight-integration.md](overnight-integration.md)
supersedes source/build counts below where explicitly stated. Stripe current-state
ownership and Android concept parity are implemented locally, and the 56 release
mock assertions from that checkpoint passed. The current release verifier now
passes 61 assertions against the selected account contract. The selected company
development account still has no Second Breakfast runtime; hosted account gates
remain open. No browser-policy retry, deployment or live billing occurred.

Recorded 30 August 2026 against the shared uncommitted beta source. This lane did not mutate the shared test database, deploy, contact testers or use live payment/grocery credentials. Integration must rerun the combined checks after final edits and record the reviewed commit and artifact digests.

Final local integration results are now in [INTEGRATION.md](INTEGRATION.md): 551 core tests, all four typechecks, 13 care helpers, the production web build and an arm64 Android review APK passed. The APK has a verified development signature, not approved distribution signing. These newer local results supersede pending build statuses below, while the real-account, device, current-alpha handoff and hosted release gates remain unchanged.

| Evidence | Result | What it proves |
| --- | --- | --- |
| [Current release verifier](checks/release-current-account.txt) | 61 assertions pass | Actual PowerShell release script for account `734702670689`; includes standalone candidate/rollback verification, artifact-free CodeBuild, digest-bound ECR config and zero-finding scan checks, plus cohort, drift, rollout and kill-switch safeguards |
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
| AWS identity/revision/rollback/schedule | Candidate and rollback verified; runtime blocked | Development account `734702670689` and both exact image provenances were verified. No Second Breakfast runtime exists |
| CodeBuild candidate | Passed | Exact versioned source, manifest, OCI labels, runtime config and immutable digest verified; ECR BASIC scan found zero findings. Inspector enhanced scanning is disabled and the image is undeployed |
| [Private infrastructure validation](checks/private-infrastructure-validation.json) | Templates and inert prerequisites pass | Database, runtime and expiry templates pass cfn-lint, live AWS validation and cfn-guard; expiry sequencing passes 8 tests. The 15-entry Cloudflare prefix list exists and the ACM certificate is pending DNS validation. No service, stack, database, load balancer or endpoint exists |
| Android / Wispling | See dedicated reports | Source/helper/prebuild evidence is separate from APK signing, OS dispatch, emulator and physical-device checks |

## Worker privacy boundary

Audited source is `apps/web/modules/offline/worker.js`; `scripts/build-care-offline.mjs` generates the public worker and catalogue bundle during web prebuild. There is deliberately no `public/care-offline.html`. The worker constructs an account-independent HTML Response from a generated literal and stores it under a virtual cache key. Normal online navigation always uses the server response, including 404 or denied care. Only a rejected network navigation uses the generic document. Static JS and art remain public source assets, not protected data.

The public cache accepts exact generic bundle/icon paths, Next static JS/CSS/fonts, and named woodland raster assets. It excludes queries, other origins, authorization-bearing requests, mutations, APIs and application HTML. Precache fetches omit credentials. Redirected, private/no-store, unsuccessful, opaque, cookie/auth-varying and wrong-content-type responses cannot enter the cache. Activation removes known legacy Second Breakfast caches and retains unrelated origin caches. A cache quota failure must not turn a successfully fetched live asset into a failed request.

Offline fallback is not authorization and is not an account-specific entitlement. A previously installed worker can keep generic local ideas after logout or cohort revocation; it cannot retrieve private data or write a list offline. A kill switch cannot remotely erase an installed APK or its local public catalogue. Online server access remains authoritative. Do not promise immediate revocation inside an already rendered page.

Generated artifacts at this handoff: `sw.js` SHA256 `db6ec08b5a561d37b8faaac5c000daa6579c5df2fe6a826be05a9ed07785d6e4`; `care-offline.js` SHA256 `20f10448571dc53d293f573294f3c2ebc25a02994ab24bea0f50f756cf5e20cd`. These are local source artifacts, not a deployed image digest. Prebuild must regenerate them if catalogue/worker source changes.

The browser harness uses synthetic account labels, no real Clerk sessions, and a deliberately failed `/care` network navigation. It does not prove airplane mode, actual Clerk logout/account switching, browser back-forward cache behavior or session expiry. Those checks remain required with disposable real sessions. This lane's browser connection timed out twice; fresh successful v3 checks were performed by the web lane and identified as such.

After that v3 pass, the web lane's canonical development app reload was blocked by browser URL security policy with an explicit instruction not to retry or use alternate surfaces. No workaround was attempted. Remaining post-fix form/plans screenshots are pending; this later limit does not invalidate the earlier v3 harness evidence. Integration's later AWS STS recheck still reported an expired session.

## Release blockers and review gates

1. Create the reviewed private HTTPS runtime with rollback digest `79d7d53c...`
   as its initial beta-disabled revision. The saved CodeBuild project must remain
   placeholder-only between reviewed builds. HTTP 200 is not revision evidence.
2. Preserve the reviewed combined source and record approved cohort signing.
   Final local tests, typechecks, web build and review APKs passed, but the APKs
   use the local debug certificate.
3. Exercise actual invited/non-invited/signed-out sessions, sign-in restoration,
   account switching/logout, expired settings reads and failed/ambiguous writes
   on web and Android. Verify no private cache entries and no false saved message.
4. Complete Android emulator or physical-device interaction and both-direction
   Wispling launch, absence, onboarding and return checks. Physical testing
   remains separate. Check keyboard, enlarged text, TalkBack/screen reader,
   themes and reduced decoration against final builds.
5. Finish hosted test integration acceptance. See [Stripe setup](../STRIPE_SETUP.md).
   The read-only audit verified the test account, exact app-scoped catalog, and
   compatible portal configurations. No webhook endpoint exists. Keep checkout
   and live mode false for the free beta. Grocery tests use a loopback stand-in.
6. Record usability/safety approval and a named manual feedback destination,
   then obtain the cohort's Clerk IDs privately. No invitation is automatic.

## Repeatable local commands

Run in PowerShell from the canonical repository; no AWS executable is used by the mocked release tests.

```powershell
node scripts/build-care-offline.mjs
powershell.exe -NoProfile -File scripts/check-beta-release.ps1
node --test scripts/check-beta-authorization.mjs scripts/check-beta-image-report.mjs
pnpm --filter @seconds/core exec node --import tsx --test test/offline-privacy.test.ts test/offline-parity.test.ts test/carts-kroger.test.ts
```

For fresh browser worker QA, set `$env:CARE_HARNESS_PORT='3097'`, run `node scripts/care-offline-harness.mjs`, then open `http://localhost:3097/qa`. Use Install, Update, and Test offline navigation. Verify `/care-offline.html` returns 404 both before and after install; temporary open/warm choices should yield no match. The server binds loopback and is never mounted in the application. Use a fresh port/origin for an independent first-install test.
