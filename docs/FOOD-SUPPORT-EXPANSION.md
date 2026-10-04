# Food support expansion

Selected by James on 3 October 2026. Notion owns the PRD; Linear SSE-144 tracks delivery and SSE-145 retains the future-scope history. This document defines the implementation slices and acceptance boundaries.

Savortome offers practical food support. Gamification is reserved for a potential neurodivergent fitness app. Do not add points, streaks, quests, eating rewards or food scores here. Existing optional cooking-confidence settings are not approval for a reward system. Calorie targets, weight goals and fitness tracking are outside this work.

## BARCODE: product capture to pantry

- Accept product GTIN-8, UPC-A, EAN-13 and GTIN-14 with valid check digits. Reject URL/QR payloads. Provide manual entry when camera access is unavailable or declined.
- Lookups go through a bounded server request to one approved provider. Send the barcode only, never account, dietary, allergy or pantry information. No arbitrary URL fetches.
- Product names and package labels are editable suggestions. A package label is not the number purchased. Require a separate human-confirmed quantity and unit before writing.
- Distinguish loading, not found, unavailable, offline and expired-session states. Keep edits on failed writes. An uncertain write must say it could not be confirmed and reload state before retry.
- Barcode matches never establish allergen safety. Direct people to their physical package. Reuse existing storage guidance with its sources and limitations.
- Provider licensing/attribution and actual lookup acceptance are gates before enabling a provider. No purchase callback is implied by a scan.

## FOOD-LOG: optional editable photo and voice drafts

- A person can record a meal with text without AI. Optional photos and audio may propose food names; unknown portion size remains unknown. Do not claim precise calories or nutrients from an image.
- Require explicit review and save. Eating records are separate from groceries and do not automatically decrement pantry stock or mark eating complete in Wispling.
- Server-authenticated provider access, strict schemas, bounded payloads/timeouts, default-off metered features and content-free audit records. Reuse the dedicated OpenAI project configuration.
- Do not retain raw images/audio as log records or telemetry. Explain transmission before capture. No health history or diagnosis is requested.
- Scope saved records to the current account; suppress late responses after account changes. Support correction and deletion. Retain drafts after a failed save without persisting sensitive drafts in general device storage.
- Native camera/microphone additions require a new binary and device validation. A web recorder or keyboard dictation is not proof of native recording.

## CHECK-IN: a gentle invitation

- A user-opened daily surface asks whether they would like meal ideas, with a visible Not now option. It is not an eating-compliance score or a notification.
- Reuse Plan together and the deterministic Care catalogue. Label likely pantry availability and missing ingredients; never relax dietary/allergy restrictions to fill results.
- Offer repeating a saved meal through an explicit confirmation. No automatic shopping, consumption, pantry or meal-plan writes.
- Scheduling remains opt-in with quiet hours, snooze and easy disable. Do not introduce background reminders as part of the first surface.
- Test signed-out, missing settings, empty inventory, offline, expired-session, account changes and failed writes. Do not shame skipped days.

## CATALOGUE: more ready-to-cook recipes

- Expand the original starter catalogue from 12 to 24 recipes, including short-cook, no-cook, use-it-up and make-ahead options.
- Stable identities, quantities, equipment, servings and ordered steps. Include waiting time in total duration so overnight food never ranks as available right now.
- Use existing Discover and copy-to-library flows and transactional idempotent seeding. Do not overwrite users' copies.
- Ingredient labels describe the recipe as written; neither tags nor a catalogue entry verify allergy safety. No imported commercial recipe database or paid generation is necessary.
- Written recipes still need cooking/usability review. Source tests do not establish kitchen-tested results.

## Delivery status, 4 October 2026

Branch `codex/food-support-expansion`, based on `main` at `abf335f`. The first checkpoint `e013f47` adds the 24-recipe catalogue and shared barcode validation. Native food notes are checkpointed at `14e7c4a`. Receipt recovery PR124 and pantry review recovery PR125 were merged into this feature branch (not main) at `fb53016` and `dbc9635`; both source test suites and both CI steps were retained. The originals remain preserved and the PRs are still open. Earlier CI results apply to those original heads, not to this unvalidated integration.

No new native binary, provider enablement, production database write, deployment or fitness-app change is implied by this checkpoint. Browser, assistive-technology, physical-device, provider and owner acceptance remain separate checks.

Source checks: all 695 core tests passed, including barcode validation and catalogue timing/quality contracts; the isolated PGlite starter-seed idempotency/repair regression passed; core TypeScript and diff whitespace checks passed. The first root-level test command could not resolve `tsx`; rerunning from the core package resolved the runner and passed. No paid API calls were made. Recipe cooking trials and integration into a deployed catalogue remain open.

### Overnight source iteration

James clarified that he is sleeping, and authorized building/iteration until 9 AM Pacific on 4 October, while skipping tests, typechecks, release builds and deployments tonight. The later changes below are **source-only and unvalidated**; the 695-test result applies only to the first checkpoint.

- Fixed-origin, bounded Open Food Facts product-label adapter; authenticated, default-off lookup route. Custom application/contact User-Agent required. Conservative process-local spacing is not a multi-instance egress quota. Provider licensing/usage registration, real response compatibility and a shared rate limiter remain enablement gates.
- Web manual barcode/label entry and native Expo Camera barcode capture, explicit editable quantity, unknown quantity support, then the existing transactional review queue. No product images, nutrient scores, purchase inference or automatic inventory changes.
- Shared food-note contract; account-scoped, retry-identifiable database storage; source-generated additive migration `0020_food-notes` (not applied anywhere); authenticated no-store list/save/delete endpoints.
- Default-off OpenAI photo/voice drafts with bounded uploads, structured output, visible uncertainty, unknown photo portions and content-free audit records. No paid calls or provider configuration changes. Raw photo/audio/transcript are not food-log records.
- Web `/today` surface: optional meal-planning invitation, Not now, strict dietary-tag matching and detected-allergen exclusions, named pantry matches/missing items, editable food notes, manual save, confirmation before removal, repeat drafts and photo/browser audio capture. No scheduled notifications, eating-compliance metrics or pantry decrement.
- Exact Expo 57-compatible camera/audio/file-system dependencies. Camera and microphone are requested just in time, with no background recording/playback enabled. A new native binary is required later; no APK/OTA was built tonight.

Native iteration now adds protected `/today`, a Cook entry point, editable text notes and repeat drafts, confirmed removal, strict-tag pantry ideas and optional photo/foreground voice capture. Voice recording is capped at45 seconds, never sent until explicitly requested, and app-cache media is removed on discard/navigation/background/provider processing; photo pickers never intentionally delete original library images. Native token access is account-pinned. Server request bodies are bounded after authentication; new shared client timeouts no longer depend on native `AbortSignal.timeout` support. Web Today now guards late A-B-A account results with an epoch in addition to the account ID. These changes remain source-only, not device proof.

Selected-day notes now load through a date-scoped request on both platforms instead of filtering only the recent-history window. Loading/failure states do not claim an empty history, and the 30-note display cap is explicit. Native focus return refreshes notes while retaining the unsaved text draft.

Native Cook and Today now remount private state on account changes. Existing native pantry reads/writes and searches use the account-pinned client; stale search responses are ignored. This is a source privacy improvement, not verified account-switch acceptance.

The next source iteration adds capability-based browser barcode camera capture with manual fallback, environment-facing camera preference, local-only decoding, Escape/close controls, return focus, single valid-code acceptance and a45-second limit. Unsupported browsers never need to download a scanner or upload camera frames. QR codes, arbitrary links and compressed UPC-E are not accepted. Both platforms now require a separate lookup action after capture. Finding a code alone transmits and saves nothing.

Web/native barcode submissions now use immediate action locks and retain the exact draft/reference after an unconfirmed write. Fields stay unchanged until the same review is retried or the local entry is explicitly discarded; discard warns that the earlier request may already have saved. Lookup availability failure is distinct from deliberately disabled lookup. Native camera permission completion is guarded against navigation, backgrounding and account changes; its live camera also times out after45seconds. These are source safeguards, not verified duplicate/concurrency or device results.

Web voice capture now invalidates a pending microphone grant when hidden, discards held recordings on hide/navigation, and suppresses stale stop/error events across account changes. Food-note deletion now has a bounded authenticated request body; interrupted upload reads return a generic error without raw transport diagnostics. New barcode styling uses the existing surface/border tokens. No rendered theme/accessibility result is claimed.

The following source increment gives food notes an immutable submitted draft on both platforms after an unconfirmed write. Retries reuse its ID and contents; editable fields, replacement drafts and photo/voice generation are locked until the result is reconciled or the local draft is explicitly discarded. Reload checks the submitted date and only confirms a save when all note fields match. A failed reload does not clear the uncertainty. The date-read cap is30, so absence from that window is never treated as proof that nothing saved. An exact match unlocks reviewed editing without silently deleting the saved note. Immediate action guards and read versions prevent duplicate mutation actions and late recent-history reads from replacing later write state. Local input validation happens before submitting.

Native capture now serializes overlapping recorder-stop calls; a discard request takes precedence over keeping the recording. Start/photo/send actions have immediate guards, cancelled send confirmation retains the unsent recording, and stale camera permission completion cannot open a picker after navigation. Cache cleanup verifies the normalized file path is inside the cache directory and rejects encoded separators/sibling prefixes. Native URL/filesystem behavior and recorder timing still need actual SDK/device validation. Web microphone permission has a12-second recoverable waiting limit; a late grant is closed rather than starting recording.

Web Today and barcode intake now pin the initiating Clerk session through an optional comparison header. The server compares it to independently authenticated `auth().sessionId` before reading or upserting user rows. A mismatch rejects the request; the header cannot choose a user, grant access, or replace Clerk authentication. Existing callers without the header retain their prior behavior. These screens remount private state when the session changes and show explicit loading/sign-in recovery while Clerk is unavailable. Server pages pass the actual Clerk configuration state, so local development without a Clerk provider can use the existing development account without calling Clerk hooks. Production still refuses unconfigured authentication.

Bounded barcode/food-note JSON uploads now have a15-second total streaming deadline in addition to byte caps. Stalled/failed uploads return generic, content-free errors and cancel the reader. This is source hardening, not measured network or adversarial-upload proof.

Still to iterate: native unexpected recorder failures and cache lifecycle; provider media signatures/format/retention/shared-rate-limit boundaries; capture availability retries and theme polish. No tests/typechecks/builds or browser/native/provider/deployment success are claimed for the later source increments. The session comparison and keyless-development paths specifically need later signed-in, loading, expired-session, A-B-A account switching and mocked boundary checks.

Live SSE-145 was read and retains FUTURE-04/FUTURE-05 as In Progress. The Linear connector requires reauthentication, and the authenticated browser comment editor did not resolve reliably; no new Linear status or comment is claimed. Notion received the approved expansion and gamification exclusion on 3 October.

Implementation references: [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [image inputs](https://developers.openai.com/api/docs/guides/images-vision), [Open Food Facts API and license requirements](https://openfoodfacts.github.io/openfoodfacts-server/api/), and [barcode normalization](https://openfoodfacts.github.io/openfoodfacts-server/api/ref-barcode-normalization/). These are provider constraints, not evidence of a working deployed integration. Do not assume the older v2 API is the current recommendation; current documentation recommends v3 for new integrations.

Browser camera source follows the [Shape Detection API specification](https://wicg.github.io/shape-detection-api/#barcode-detection-api). Browser support and installed-device acceptance remain pending; manual entry is the universal fallback.
