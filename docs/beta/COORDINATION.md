# Private beta parallel work

The user approved the whimsical private beta plan and requested parallel tasks on 30 August 2026. This file is the working handoff, not a claim that the beta is ready for release.

## Repositories and safety

- Canonical Second Breakfast: `C:\Users\James\Documents\GitHub\SecondBreakfast`, branch `codex/whimsical-private-beta`, base `dcb6f71`. All current beta changes are uncommitted. Do not reset, switch branches, stash everything, or commit another task's files.
- The app project directory `C:\Users\James\Documents\ChatGPT\Second Breakfast` is an empty project shell with an unborn master branch. Do not build a duplicate app there.
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

## Parallel validation update, 30 August 2026

These newer results supplement the earlier draft evidence below. They do not replace final combined-build validation.

- Care/data reported 540 passing core tests, 21 focused tests, and ten successful fault-injected transaction/account-isolation scenarios. Evidence is under `checks/care-data-*`. The final existing DB suites are still running serially; this lane retains the shared fixture window.
- Web reported four passing care-state tests and a passing web typecheck. Contrast, fixed-return preservation, labeled navigation, text scaling and current screenshots are being checked. Actual Clerk sign-in is still unavailable in the local no-key preview.
- Native reported seven passing mobile tests, six Wispling tests and typechecks. Generated CMake staging was shortened without changing the SDK. An isolated, verified newer Ninja binary is being tested for remaining Windows path limits. No successful native artifact, emulator interaction or physical-device test is claimed by this update.
- Privacy/release reported 38 real-script mocked assertions and seven worker VM tests. Trusted CodeBuild report verification, rollback hardening, alternate-entry review and fresh browser evidence are still in progress. No AWS mutation occurred.

## Implemented draft

- Fourteen authored food ideas, deterministic hard effort/time/sensory/dietary limits, at most three choices, optional pantry ranking. Exported from `@seconds/core/format`.
- Strict seven-field handoff parser; fixed `wispling://care-return`; no health/history/completion transfer.
- Web `/care` and public mobile care outside protected routes; native controls, optional preferences, saved-setting failure notices, temporary restrictions, authenticated shopping writes, preserved sign-in choice.
- Request-scoped server Clerk-ID beta gate, disabled by default. Local preview works only in development. Uninvited users retain the previous shell.
- Woodland light/dark tokens, raster hearth and separate transparent kettle/journal prop. PR #38 skillet assets preserved. Concept board includes library/cook/care/desktop and separate optional Wispling visitor comparison. No character in the implemented default.
- Service worker stores only explicit public/static assets and generic offline care. Legacy account caches removed. All APIs now request private/no-store headers.
- Recipe creation/import/edit and ingredient indexing now share transactions; remote PostgreSQL TLS now verifies certificates and strips URL overrides that could disable it.
- Isolated Wispling button, installed-app detection, browser fallback, Android package query plugin, onboarding-aware return route. Feature flag defaults off.
- Draft `scripts/beta-release.ps1` inspects identity, prepares immutable candidate/rollback definitions, enrolls exact Clerk IDs, and deploys or rolls back existing ECS service without changing its schedule/capacity. It has only had a PowerShell parser check, not mocked or live execution. Audit it before use.

## Verified evidence so far

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

## Local runtime and limits

Disposable PostgreSQL is already running at `postgresql://sb_beta@127.0.0.1:55494/seconds_beta`. Data directory is under `%LOCALAPPDATA%\SecondBreakfastBeta\pg-data`. Only this database may be used for destructive fixture tests. No production data was copied. Its unused vector column uses a double array because local pgvector is unavailable; this does NOT validate production pgvector migrations.

Local Next dev server on port 3094 uses that DB, blank Clerk keys, and `SB_BETA_ENABLED=true`, `SB_BETA_LOCAL_PREVIEW=true`. This is a synthetic local account. Production test server 3095 was stopped. Offline browser harness 3096 is running and binds loopback; it is not mounted in the app. The browser automation session reset during a later wide-layout capture. Some library/cook screenshot filenames say desktop but their image is narrow: inspect and rename or recapture, do not misreport them.

Android SDK: `C:\Users\James\AppData\Local\Android\Sdk`. Prefer `JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot`, Gradle `--max-workers=2 '-Pkotlin.compiler.execution.strategy=in-process' '-PreactNativeArchitectures=arm64-v8a,x86_64'`. Root Gradle runs were stopped before native lane handoff, caches preserved. Do not use the default Android Studio JDK 25 for this retry. Existing mobile `.env` contains a test Clerk publishable key; do not print it or copy it into committed files. Earlier build/export explicitly blanked this key, so distinguish a guest-only preview from an account-capable cohort build.

The `medium_phone` emulator cannot start with acceleration because the hypervisor driver is missing. A software-emulation fallback also failed to expose an adb device. Do not install system drivers or claim emulator success. Physical-device testing is separate and not done.

AWS profile `secondbreakfast-toolkit` is expired. Expected account `574921529762`, region `us-east-2`, cluster `secondbreakfast-cluster`, service `secondbreakfast-web`. Public site responded HTTP 200 on 30 August, but deployed revision, running image digest, rollback configuration, and current scale-down state have NOT been read. No deployment was made. Existing API/grocery/payment test/stub checks do not prove live credentials.

## Remaining delivery requirements

See `PLAN.md` for accepted scope. Finish the owned implementation, meaningful tests, production/Android artifacts, browser and available-device QA, runbooks, and precise blockers. Keep care usable offline and without an Android account. Hosted care remains invite-only. Require reviewed usability/safety and device/account checks before cohort rollout; public food support is out of scope. No new mascot, rewards, semantic search, food reminders, medical guidance, or iOS release.
