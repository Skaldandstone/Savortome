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

Branch `codex/food-support-expansion`, based on `main` at `abf335f`. The first checkpoint `e013f47` adds the 24-recipe catalogue and shared barcode validation. Existing receipt recovery PR124 and pantry review recovery PR125 remain independent; preserve both test suites when integrating.

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

Still to implement/iterate: native Today/food-note/photo/voice surface and entry points; source review of late account-switch/unmount results, uncertain-write recovery, camera/audio lifecycle and privacy; compatibility review of provider formats and platform timeout support; themed component polish. Web camera barcode scanning is not yet implemented (manual entry works in source). No browser, native-device, provider or deployment success is claimed for these changes.

Live SSE-145 was read and retains FUTURE-04/FUTURE-05 as In Progress. The Linear connector requires reauthentication, and the authenticated browser comment editor did not resolve reliably; no new Linear status or comment is claimed. Notion received the approved expansion and gamification exclusion on 3 October.

Implementation references: [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [image inputs](https://developers.openai.com/api/docs/guides/images-vision), [Open Food Facts API and license requirements](https://openfoodfacts.github.io/openfoodfacts-server/api/), and [barcode normalization](https://openfoodfacts.github.io/openfoodfacts-server/api/ref-barcode-normalization/). These are provider constraints, not evidence of a working deployed integration. Do not assume the older v2 API is the current recommendation; current documentation recommends v3 for new integrations.
