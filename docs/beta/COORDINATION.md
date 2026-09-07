# Private beta parallel work

The user approved the whimsical private beta plan and requested parallel tasks on 30 August 2026. This file is the working handoff, not a claim that the beta is ready for release.

## 31 August final release-verifier continuation

Integration retargeted the fail-closed release verifier from historical account
`574921529762` to selected development account `734702670689`, profile
`skaldandstone-dev`, region `us-east-2`, and the exact foundation resources. The
current CodeBuild project deliberately emits no report artifact, so the verifier
now binds the successful build and versioned S3 checksum to the immutable ECR
manifest, a config blob whose SHA-256 equals its manifest digest, exact
source/revision/privacy labels, the nonroot distroless boundary and completed
zero-finding BASIC scan. Sixty one strict mocked assertions pass.

Live read-only `VerifyImages` passed for final candidate `bfb6f728...` and
rollback `79d7d53c...`. Both are privacy-v3, zero-finding BASIC images with exact
versioned source and CodeBuild provenance. No Second Breakfast ECS service,
load balancer, endpoint, DNS, secret or billing mutation occurred. The remaining
cloud gate is the reviewed private HTTPS foundation, initially pinned to the
rollback image with beta disabled. Current evidence is in
`docs/beta/final-integration-checkpoint.md` and `docs/beta/release-runbook.md`.

## Latest integration checkpoint

31 August daytime UI continuation integrated: the web lane handed back 45 verified
source/style-guide entries. Integration fixed the pending dietary-profile save
race in the form and added three regressions, retaining the original handoff.
Current local web build is `RHF3PnWQrDsVQJjkCCXDQ`; 48 focused checks, web typecheck
and build pass. A new 337-source/476-output manifest records the exact revision.
All 36 protected files, 161 native sources and three APKs are unchanged. No build
remains active in this lane. See [web-ui-integration.md](web-ui-integration.md).
Browser restrictions and all real-account/device/visual/release gates remain.

31 August image-security continuation completed locally: integration changed only
`apps/web/next.config.ts` among prior runtime/config files, closing the unused
optimizer and removing wildcard remote hosts. The web-only build passed as
`JU_bSJRJvJgnvh6kH4QVX`; all three APKs, 161 native source hashes and tested billing
sources are preserved. No Android build or browser retry. The parser remains
unchanged and bounded ICNS/JXL probes reproduce worker exhaustion. See
[image-parser-security.md](image-parser-security.md). No build remains active in
this lane; previous web build identities below are historical.

**31 August overnight continuation:** Integration owns local Stripe lifecycle hardening and Android concept parity until the authorized 09:00 America/Los_Angeles cutoff. Completed sibling sources remain preserved. No package changes, new tasks, cloud deployment, live billing or browser-policy retries are planned. Stripe connector reauthentication remains an owner blocker; tests use local fixtures. Cloud coordinator reports the selected company development account is now `734702670689`, profile `skaldandstone-dev`, region `us-east-2`, with no Second Breakfast runtime yet. Account `574921529762` is the prior deployment, not the selected rebuild target. Existing release identity/revision/privacy-v3 rollback gates remain required and have not been retargeted automatically.

Android source is frozen for a new account/guest artifact pair. Wispling's native
owner released its completed build window before Second Breakfast started. The
account APK built successfully in 4m 2s and its signature, final bundle markers,
four byte-identical art assets and all 161 source hashes were checked. Guest build
also passed in 1m 57s, with the test key absent and all source/art checks passing.
The final web build is `8SppsANVHSszqZHJ20R5P`; its production build and ten
regenerated offline checks pass. Native ownership was released back to Wispling;
no further heavyweight build is planned. Full evidence is in [overnight-integration.md](overnight-integration.md).
The original APK is preserved, and no SDK or dependency mutation was needed.

**Concept rebuild integrated:** Task **Beta: woodland web and accessibility** handed back 26 source/art files after James rejected the palette-only implementation. Parent verified that handoff and completed the follow-up fixes, lossless asset encoding, new regression tests and production build described in [web-concept-integration.md](web-concept-integration.md). All four typechecks and 551 core tests pass again. Runtime source ownership is back with integration. The earlier web build/screenshots below are historical and do not validate this revision. The Android APK remains unchanged. Browser access restrictions still apply; no new running-UI visual acceptance is claimed. No other lane has been reopened.

The [integrated report](INTEGRATION.md) supersedes the historical progress snapshots below. Care/data, web/accessibility and privacy/release have handed back stable source. Their final reports record 335 existing database assertions, ten recipe rollback/isolation scenarios, fresh v3 browser worker evidence, and 56 mocked release assertions. The shared disposable database reservation is released.

Root integrated both Stripe source commits and independently passed five PostgreSQL billing scenarios. The combined core suite passes 551 tests, all four workspace typechecks pass, the latest care helper run passes 13 tests, and the final production web build passes. Regenerated worker/privacy parity passes ten tests. See `checks/integrated-*` and the individual reports for exact scope. The keyless web build is not an account-enabled hosted image.

Android has completed its final incremental build and released the native/dependency window. Its exact Expo-compatible pins are Worklets 0.10.1 and Reanimated 4.5.1. The final review APK includes the account-loading care link, has SHA-256 `b828dcf86cbba709d0fc1905a38e5cf1495cb8acd789e4c2357aae0fe4d82957`, and verifies with the Android debug certificate. Root independently found zero drift in 107 source and three dependency hashes. All four lanes have completed their evidence handoffs and returned ownership to integration. No additional installs or builds are needed for this review snapshot. Source and dependency fingerprints live in `checks/android-*-manifest.json`.

Browser access explicitly denied the last local app reload under URL policy. No browser retry, alternative browser, port, proxy or other access workaround is authorized. Preserve earlier valid captures; unresolved post-fix UI/accessibility checks await permitted access. The web report records their exact scope.

The active Wispling alpha selects `src/alpha/AlphaApp`, so the isolated legacy handoff is not active-alpha integration. Its milestone excludes this work. Do not apply the legacy patch to alpha or replace its shell. See `handoff-evidence.md` and the narrow alpha adaptation proposal for the remaining integration boundary.

The newer task **Add preference-based dining search** moved its proposal and root README link into `C:\Users\James\Documents\GitHub\.worktrees\secondbreakfast-dining`, branch `codex/restaurant-discovery`, after verifying the copy. The canonical proposal is absent and README has no content diff against HEAD; Git status still reports a stat/line-ending modification, so do not describe the entire status as clean. Preserve that isolated future product work; it is outside the frozen beta and is not a stale task to archive. The separate studio copyright task has finished; its uncommitted legal files and references remain preserved, not silently absorbed into a beta-only commit.

## Repositories and safety

- Canonical Second Breakfast: `C:\Users\James\Documents\GitHub\SecondBreakfast`, branch `codex/whimsical-private-beta`, base `dcb6f71`. All current beta changes are uncommitted. Do not reset, switch branches, stash everything, or commit another task's files.
- The saved app project must resolve to the canonical checkout at `C:\Users\James\Documents\GitHub\SecondBreakfast`. Do not build a duplicate app under the former `ChatGPT` path.
- Wispling handoff only: `C:\Users\James\Documents\GitHub\.worktrees\wispling-second-breakfast`, branch `codex/second-breakfast-handoff`, base `e9bf7f3`. Canonical Wispling contains unrelated ongoing work. Do not edit it.
- A concurrent studio copyright task added `apps/web/ui/LegalFooter.tsx`, `apps/mobile/app/legal.tsx`, footer references in web layout, and a legal link in the protected mobile tab layout. Preserve this work and exclude it from beta-only commits unless its owner has committed it first.
- Integration and final commits belong to the parent task. Each child owns only its lane below, keeps changes reviewable, reports exact files and validation, and coordinates shared-file needs through the parent. No live rollout, invitations, purchases, charges, or public launch from child tasks.
- Use existing dependencies and infrastructure. Only the Android lane runs Gradle. Avoid duplicate heavyweight builds and do not kill unrelated processes.

## Ownership

| Task | Owns | Does not own |
| --- | --- | --- |
| Beta: care logic and data integrity | `packages/core/src/care.ts`, care tests, `packages/db` transaction/TLS fixes and database fixture tests | web/mobile UI, service worker, release scripts |
| Beta: woodland web and accessibility | web care/woodland components, existing feature visual polish, web layout/page styling, `STYLE_GUIDE.md`, `design`, web art, `docs/beta/web-*` | beta authorization module/page gates, service worker, database, mobile |
| Beta: Android and Wispling handoff | `apps/mobile`, isolated Wispling handoff worktree, `docs/beta/android-*`, `docs/beta/handoff-*` | core catalog/API contracts without coordinating, canonical Wispling, web |
| Beta: privacy and release readiness | web service worker/offline shell, `apps/web/lib/beta.ts`, care page authorization, `next.config.ts`, offline/privacy tests, `Dockerfile.web` release build flags/labels, release/enrollment scripts, beta runbooks | illustration UI, mobile, recipe transaction implementation |
| Beta: integration and rollout | cross-lane review, shared manifests/lockfile coordination, final validation, commits and release decision | overlapping child edits while they are active |

Shared package manifests and the lockfile need parent coordination. A lane may run targeted tests; do not concurrently regenerate Expo native files or mutate the same test database fixtures. Use synthetic users with unique IDs and clean up only your fixtures.

## Active task IDs

- Integration: `01a0546f-008c-7603-bacc-cf95b56a3323`
- Care/data: `01a054aa-69b3-7b70-891a-04a399ad9a18`
- Web/accessibility: `01a054aa-ab4d-7781-bace-716ca841a178`
- Android/Wispling: `01a054aa-eb24-7b22-bb5c-f77369551bdb`
- Privacy/release: `01a054ab-2e42-7223-9498-a9ae9e6a3ba8`

All are forks in the Second Breakfast app project. The older repository-cleanup task was already archived. No unrelated project tasks were archived.

## Integration decisions during parallel work

- Care slots use distinct candidates in deterministic ranked order after all strict filters. Equal-time alternatives are valid for A little more; do not skip a better pantry match just to find a slower option. One candidate gives Right now, two add A little more, and a third can be Future me. Every restriction also applies to Future me. Contract field names remain unchanged.
- Care/data has exclusive ownership of shared disposable DB fixture mutations and suite runs until it reports completion. Other lanes coordinate needed fixture changes through integration.
- Care/data owns the additional recanonicalizeRecipes row/index rollback gap and effective-host PostgreSQL TLS parsing fix. Test the installed driver without production connections or credential changes.
- Web owns contrast fixes and UI-local preservation of the fixed Wispling return through sign-in. Restored handoff data must be allowlisted and revalidated; no new protocol fields or private-data transfer. Server redirect changes remain with privacy/release.
- Privacy/release may add a default-false SW build argument and an OCI commit-revision label to Dockerfile.web. Server beta authorization remains independent. A runtime revision environment variable alone is not evidence of the image's source revision.
- Native builds run one at a time under the Android lane. Distinguish guest previews, account-enabled cohort configuration, APK signing, emulator interaction, and physical-device testing.
- Pantry matching compares canonical ingredient names, not quantities or preparation forms. Both interfaces must say to check the required form and package directions. Matching dried beans must not change the ready-cooked-bean steps or time/effort restrictions.
- The Stripe owner's isolated commits `27642cad8f8153a1bae30fbfae1a7f7494cd8ec0` and `001cb5a6f64c372c22f2c6cbf83bf6eac7c8976f` were reviewed and integrated as source changes, preserving woodland CSS and beta TLS/mobile work. Parent independently passed PGlite plus five local PostgreSQL scenarios, including actual multi-connection Session locking. See `stripe-integration-evidence.md`. Checkout and live mode remain false. pnpm automatically synchronized the added DB test dependency during test execution; use direct Node entrypoints until native releases its build window.
- Full container rollback must not restore the old broad private-response caching. Prefer disabling the beta on the hardened image; require a reviewed privacy-hardened previous image before enabling the cohort.
- Privacy/release removed the public `/care-offline.html` entry and embeds an account-free template in the generated worker instead. Only failed navigation can receive this synthetic offline document; online requests retain the server's 404. No authenticated response is cached. Fresh v3 browser checks remain pending.

## Earlier parallel validation snapshot, 30 August 2026

Historical progress only. The latest checkpoint above and linked final reports supersede pending statuses and counts below.

- Care/data reported 540 passing core tests, 21 focused tests, and ten successful fault-injected transaction/account-isolation scenarios. Evidence is under `checks/care-data-*`. The final existing DB suites are still running serially; this lane retains the shared fixture window.
- Web reported four passing care-state tests and a passing web typecheck. Contrast, fixed-return preservation, labeled navigation, text scaling and current screenshots are being checked. Actual Clerk sign-in is still unavailable in the local no-key preview.
- Native reported seven passing mobile tests, six Wispling tests and typechecks. Generated CMake staging was shortened without changing the SDK. An isolated, verified newer Ninja binary is being tested for remaining Windows path limits. No successful native artifact, emulator interaction or physical-device test is claimed by this update.
- Privacy/release reported 38 real-script mocked assertions and seven worker VM tests. Trusted CodeBuild report verification, rollback hardening, alternate-entry review and fresh browser evidence are still in progress. No AWS mutation occurred.

## Earlier implemented draft

- Fourteen authored food ideas, deterministic hard effort/time/sensory/dietary limits, at most three choices, optional pantry ranking. Exported from `@seconds/core/format`.
- Strict seven-field handoff parser; fixed `wispling://care-return`; no health/history/completion transfer.
- Web `/care` and public mobile care outside protected routes; native controls, optional preferences, saved-setting failure notices, temporary restrictions, authenticated shopping writes, preserved sign-in choice.
- Request-scoped server Clerk-ID beta gate, disabled by default. Local preview works only in development. Uninvited users retain the previous shell.
- Woodland light/dark tokens, raster hearth and separate transparent kettle/journal prop. PR #38 skillet assets preserved. Concept board includes library/cook/care/desktop and separate optional Wispling visitor comparison. No character in the implemented default.
- Service worker stores only explicit public/static assets and generic offline care. Legacy account caches removed. All APIs now request private/no-store headers.
- Recipe creation/import/edit and ingredient indexing now share transactions; remote PostgreSQL TLS now verifies certificates and strips URL overrides that could disable it.
- Isolated Wispling button, installed-app detection, browser fallback, Android package query plugin, onboarding-aware return route. Feature flag defaults off.
- Draft `scripts/beta-release.ps1` inspects identity, prepares immutable candidate/rollback definitions, enrolls exact Clerk IDs, and deploys or rolls back existing ECS service without changing its schedule/capacity. It has only had a PowerShell parser check, not mocked or live execution. Audit it before use.

## Earlier verification snapshot

- 522 core unit tests passed (baseline 512). All four typechecks passed after changes; see `docs/beta/checks/typecheck.txt`.
- Web production build passed, `docs/beta/checks/web-build.txt`. Later small source/header changes require another final build.
- Fifteen DB suites passed 335 assertions against disposable local PostgreSQL. `docs/beta/checks/*.txt` contains evidence.
- Fault-injected recipe create/edit/import rollback and other-user read/write denial passed. `packages/db/scripts/check-beta-transactions.ts` only permits the disposable database.
- Existing HTTP import/shelf lifecycle passed, including idempotent re-import; see `http-shelves.txt`.
- Production server refused care with empty allowlist even with local-preview flag and forged query identity; previous layout remained. See `production-gate.json`. Real invited/non-invited Clerk sessions and expiry are still untested for this candidate.
- Browser care light desktop, dark narrow, reduced decoration, impossible open/warm request, guest save guard, settings failure, empty pantry, recipe ingredient panel and step progression were exercised. ArrowRight advanced cook steps and Tab moved focus. Nested cook main landmarks were fixed afterward. Native screen-reader and 200-percent text checks remain unverified.
- Real browser service-worker install, removal of synthetic legacy private cache, update/controller change, no API/private-page cache entries for synthetic users A/B/signed-out, and offline navigation fallback passed. See `offline-cache-update.txt` and `offline-shell.txt`. Actual Clerk logout/account switching remains unverified.
- Android Expo export and prebuild succeeded. Native APK build did not finish before lane handoff. See `android-build.txt`. JDK 25 Kotlin daemon discovery stalled; JDK 21 plus in-process Kotlin compilation progressed. CMake emitted long-path warnings in pnpm dependencies. No APK success or emulator/device validation may be claimed yet.
- Wispling handoff's three focused Jest tests and TypeScript passed. Native prebuild passed and Android queries were generated. A native build was paused to avoid duplicate heavyweight builds.

## Earlier local runtime observations and limits

Disposable PostgreSQL is already running at `postgresql://sb_beta@127.0.0.1:55494/seconds_beta`. Data directory is under `%LOCALAPPDATA%\SecondBreakfastBeta\pg-data`. Only this database may be used for destructive fixture tests. No production data was copied. Its unused vector column uses a double array because local pgvector is unavailable; this does NOT validate production pgvector migrations.

Local Next dev server on port 3094 uses that DB, blank Clerk keys, and `SB_BETA_ENABLED=true`, `SB_BETA_LOCAL_PREVIEW=true`. This is a synthetic local account. Production test server 3095 was stopped. Offline browser harness 3096 is running and binds loopback; it is not mounted in the app. The browser automation session reset during a later wide-layout capture. Some library/cook screenshot filenames say desktop but their image is narrow: inspect and rename or recapture, do not misreport them.

Android SDK: `C:\Users\James\AppData\Local\Android\Sdk`. Prefer `JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot`, Gradle `--max-workers=2 '-Pkotlin.compiler.execution.strategy=in-process' '-PreactNativeArchitectures=arm64-v8a,x86_64'`. Root Gradle runs were stopped before native lane handoff, caches preserved. Do not use the default Android Studio JDK 25 for this retry. Existing mobile `.env` contains a test Clerk publishable key; do not print it or copy it into committed files. Earlier build/export explicitly blanked this key, so distinguish a guest-only preview from an account-capable cohort build.

The `medium_phone` emulator cannot start with acceleration because the hypervisor driver is missing. A software-emulation fallback also failed to expose an adb device. Do not install system drivers or claim emulator success. Physical-device testing is separate and not done.

AWS profile `secondbreakfast-toolkit` is expired. Expected account `574921529762`, region `us-east-2`, cluster `secondbreakfast-cluster`, service `secondbreakfast-web`. Public site responded HTTP 200 on 30 August, but deployed revision, running image digest, rollback configuration, and current scale-down state have NOT been read. No deployment was made. Existing API/grocery/payment test/stub checks do not prove live credentials.

## Remaining delivery requirements

See `PLAN.md` for accepted scope. Finish the owned implementation, meaningful tests, production/Android artifacts, browser and available-device QA, runbooks, and precise blockers. Keep care usable offline and without an Android account. Hosted care remains invite-only. Require reviewed usability/safety and device/account checks before cohort rollout; public food support is out of scope. No new mascot, rewards, semantic search, food reminders, medical guidance, or iOS release.
