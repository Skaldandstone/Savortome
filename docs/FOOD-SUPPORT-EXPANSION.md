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

Availability recovery now distinguishes loading, confirmed disablement and retryable read failure for web/native barcode lookup and web photo/voice drafts. Retry buttons rerun the availability read without resetting the typed entry, quantity, pending-save reference or food note. Barcode camera/manual entry remain usable while provider lookup is disabled or unavailable. Native barcode availability refreshes on focus; blurred/stale reads cannot replace a newer result. Native food-note capture uses sequenced status reads so earlier retries cannot overwrite later results. All availability calls retain the shared12-second deadline.

Native food-note capture now only displays deliberately authored local input messages and generic SDK/provider fallback copy, with specific sign-in and timeout recovery. Raw camera/file-system/provider diagnostics are not displayed by this component. Recorder-finalization failure removes the recording from sendable UI state and attempts cache cleanup, without claiming that every hardware/OS failure has been resolved or files certainly deleted. These paths still need device validation.

Food-note drafts now check a bounded file header against the claimed media type before calling OpenAI. JPEG/PNG/WebP, WebM/MP4 audio and WAV/MP3 are recognized by small signature/container-header checks. MP4 brand scans are capped at4096bytes and WebM document-type scans at the small header prefix. This follows the [WHATWG MIME Sniffing signatures](https://mimesniff.spec.whatwg.org/#matching-an-image-type-pattern), with common M4A/ISO audio brands. It is **not** a full decoder, corruption check, sanitizer, malware scan or proof that a container contains only audio. Malformed-header and real recorder-format compatibility need later tests/provider acceptance. No extra parser/dependency or server-side image decoding was added.

Today uses a bounded desktop content width, existing journal panels, readable body text and labeled per-note controls. Barcode video styling uses theme background tokens. No rendered/accessibility result is claimed from these source edits.

The final source consistency and interruption review is recorded below; runtime verification remains deferred. Deferred gates: Open Food Facts legal/registration plus multi-instance shared egress quota; actual OpenAI retention/configuration review and photo metadata disclosure/removal policy; native binary/version bump and OS formats; database migration/application; unit/component/type/build, signed-in/session/rollback, accessibility/theme/device and owner acceptance. No provider enablement is implied by these edits. No tests/typechecks/builds or browser/native/provider/deployment success are claimed for the later source increments. Session comparison/keyless-development specifically need later signed-in, loading, expired-session, A-B-A account switching and mocked boundary checks. Native microphone teardown, app-crash cache retention and availability recovery remain open.

Live SSE-145 was read and retains FUTURE-04/FUTURE-05 as In Progress. The Linear connector requires reauthentication, and the authenticated browser comment editor did not resolve reliably; no new Linear status or comment is claimed. Notion received the approved expansion and gamification exclusion on 3 October.

Implementation references: [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [image inputs](https://developers.openai.com/api/docs/guides/images-vision), [Open Food Facts API and license requirements](https://openfoodfacts.github.io/openfoodfacts-server/api/), and [barcode normalization](https://openfoodfacts.github.io/openfoodfacts-server/api/ref-barcode-normalization/). These are provider constraints, not evidence of a working deployed integration. Do not assume the older v2 API is the current recommendation; current documentation recommends v3 for new integrations.

Browser camera source follows the [Shape Detection API specification](https://wicg.github.io/shape-detection-api/#barcode-detection-api). Browser support and installed-device acceptance remain pending; manual entry is the universal fallback.

### Final overnight source checkpoint, 4 October

The four approved implementation slices now have source on web/mobile: reviewed barcode-to-pantry, optional editable photo/voice food notes, gentle Today/check-in and pantry ideas, and the 24-entry starter catalogue. This completes the bounded overnight source pass, not product acceptance. Gamification remains excluded.

The final review closes the native background-during-recorder-stop interval: discard clears sendable state immediately and attempts cache cleanup after the existing stop settles. Food-note and draft routes now opt into content-free unexpected-error logging, so raw database failures are not passed to the general error logger by these routes. Existing unrelated route logging is unchanged. Neither fix has been tested tonight.

Source is preserved on `codex/food-support-expansion`; main and the existing deployed/mobile builds are unchanged. Receipt recovery PR #124 and pantry review PR #125 original branches remain preserved, and both CI checks remain in the integration source. The overnight heartbeat is to be paused at this checkpoint.

Next acceptance work, deliberately deferred by tonight's instruction:

- Run core/web/mobile checks and meaningful account isolation, identical retry, malformed media/link, availability and capture-interruption cases. The earlier 695-test result covers only the first checkpoint.
- Apply migration 0020 to disposable fixtures first and exercise rollback, save/reload/delete and session changes. No migration has been applied tonight.
- Inspect rendered narrow/wide layouts, themes, enlarged text, keyboard/screen-reader behavior and both native permission/capture lifecycles. Source styling is not visual/device acceptance.
- Bump native version/build number and build a new installable binary. The existing app does not contain this source; there was no APK, OTA or release build tonight.
- Before provider enablement, review Open Food Facts registration/licensing and shared egress limits, OpenAI retention and photo metadata policy, real recorder formats and explicit upload consent. Provider flags remain off and no paid/provider calls were made.
- Reconcile the source checkpoint with Linear after connector reauthentication; Notion already contains the approved scope, but its source-delivery update remains pending. No tracker completion is claimed.

No deployments, invitations, account/credential/signing changes, live billing, automatic inventory consumption or proactive reminders occurred.

### Continued overnight parity increment: planning without another errand

The coordinator supplied James's later overnight direction to keep implementing until 9 AM, researching official comparable products when the initial scope appears complete. That supersedes the earlier source-completion pause. The existing heartbeat is active again; no duplicate schedule or writer was created.

Official comparison: [Samsung Food+](https://samsungfood.com/food-plus/) describes food-list-based recipe search and prioritizing items worth using soon; [Paprika's Android guide](https://www.paprikaapp.com/help/android/) connects pantry inventory, grocery lists and meal planning. Savortome already has source pantry resurfacing and planning. The bounded missing workflow selected under existing FUTURE-04 is explicit planning limits on Today.

Web/mobile Today now offer optional saved-total limits of 10, 20, 30 or 60 minutes and a no-shopping toggle. Defaults remain unrestricted, and no effort/energy classification is inferred. Both call the same shared options contract. Server validation rejects unsupported or repeated selected fields; unknown fields are ignored. Filtering happens before the three-choice limit, preserves detected-allergen exclusions and strict dietary matching, and never fills empty results by relaxing limits. Unknown, non-finite or negative recorded times cannot satisfy a selected time limit. Search also applies the time bound before its 40-candidate cap.

No-shopping matches require all indexed ingredient names to be in the saved pantry, including staples and optional ingredients. Empty ingredient indexes do not qualify. This conservative rule avoids assuming staples but may hide a recipe whose optional ingredient could be omitted. Visible copy explains that names cannot prove quantity or preparation, stored totals may omit waiting, and the candidate window is not a complete library search. Changing limits clears old ideas; fresh results require an explicit request. Request guards prevent duplicate immediate requests. Native selected controls expose selected state; web controls use native labels and fieldset, with existing theme tokens. No preference telemetry or persistence was added.

The authenticated planning route now explicitly returns private/no-store and content-free unexpected-error logs. This is source implementation only: no tests, typechecks, builds, deployments, provider calls or visual/device claims. Formal ranking/parser/session/UI acceptance remains deferred. Linear SSE-145 reauthentication was reconfirmed; no tracker update or completion is claimed.

### Overnight parity increment: reviewed missing names to one list

[Mealime's official getting-started guide](https://support.mealime.com/article/151-getting-started-guide) connects planning to a grocery list. Today now offers a bounded missing-name review beside each pantry-based idea on web/mobile, under existing FUTURE-04 scope. Expand the review, choose names, then explicitly add them to the existing list. No recipe quantities are inferred, no whole-list replacement, no grocery order, meal-plan write or pantry change. Duplicate names are trimmed/deduplicated, with at most100 names of200characters. Staples/optional ingredients are excluded by the existing missing-name query; visible copy asks users to check the full recipe.

The existing loose-item database upsert preserves quantities and check marks. An uncertain request freezes the selected names; retry resends that exact name-only selection. Changing/hiding meal ideas is disabled until success or explicit discard of local retry state. Discard confirmation states that the earlier write may already have saved and cannot be undone by local dismissal. A shopping-list link remains available; selection is in-memory, and copy warns that leaving Today may lose local retry state. No offline persistence claim. Unmounted/account-replaced results are suppressed; native focus/version guards suppress results from an earlier visit. Notes/capture are independent, and no eating-completion event is generated.

Shared list reads and loose-item writes now use12-second deadlines, including token acquisition; timeouts remain unconfirmed rather than false success. The existing list route authenticates before reading a bounded64KiB POST body, validates loose name arrays, explicitly sets private/no-store on GET/POST/DELETE, and redacts unexpected error details. Recipe-based list behavior remains otherwise unchanged. No database/schema/dependency/provider changes.

Source-only and unvalidated: no tests/typechecks/builds/deployments/provider calls. Later checks must cover concurrent identical upserts, checked-item/amount preservation, session/focus changes, failed/slow writes, pending-selection disposal, offline/auth recovery, server body boundaries and rendered/native accessibility. Linear SSE145 reauthentication persists; no tracker status/comment posted. Recovery PRs and main are unchanged.

### Overnight continuity increment: keep the chosen recipe while planning

Today suggestions now offer an inline date/meal-slot review on web/mobile. The recipe stays selected, the date starts at the device's local today, and no meal slot is preselected. Saving explicitly adds the chosen recipe alongside existing meals, never replaces a slot or marks food as eaten. Shopping list, pantry and food notes are unchanged. This extends the planning-to-action continuity identified in the official Mealime/Samsung Food workflows, under existing FUTURE-04.

Shared reviewed-meal parsing checks recipe-ID shape, strict real calendar dates2000–2100 and an explicit breakfast/lunch/dinner slot. The new authenticated `/api/plan/meal` route reads at most1024bytes after authentication and uses the existing owner-scoped, identical-recipe/date/slot no-op database operation. A nonowned/missing recipe cannot produce a saved response; the returned selected-week plan must contain the exact meal before confirmation. It returns private/no-store and withholds unexpected raw error details. A bounded12-second client method covers token/network waiting. Existing general planner API contracts remain unchanged.

An unconfirmed write locks the exact recipe/date/slot and pauses replacement of Today ideas; retry resends it. Explicit discard warns that a meal may already be planned and does not remove it. The retry selection is in-memory only; leaving Today may lose it. Success copy describes the meal's actual date and slot and names unchanged records. Both UIs retain an explicit link to the selected week.

Native planner route now validates the incoming week, keys private state to the Clerk session/week and passes an account-pinned client rather than the shared account-agnostic singleton. Focus/visit/week guards suppress stale reads and write feedback; mutation guards block duplicate actions and week switching during a write. These changes support the new handoff and are source safeguards, not authenticated/device proof. General native planner loading/recovery and its unrelated legacy actions remain later review areas; no blanket planner acceptance claim.

Source-only: no tests/typechecks/builds/device/provider/deployment work. Later acceptance must exercise malformed dates/IDs/slots, owner isolation, concurrent exact retries, selected-week routing, account/focus changes, failed reads/writes, existing-meal preservation, keyboard/screen-reader labels, themes and actual native navigation. Main, recovery PRs, installed apps, migrations, providers and live runtime remain unchanged. Linear SSE145 reauthentication persists; no status/comment update claimed.

### Overnight native planner recovery increment

Native planner loading is now distinct from a confirmed empty week. Initial/week-switch grids wait for a successful read; a refresh can retain the last loaded meals with a visible stale-view warning. Failed/loading reads disable edits and expose an in-place retry. Recipe-library loading/failure no longer implies an empty collection; the picker retains filter and old recipes but pauses selection until a successful refresh, with a separate retry. Sequenced read guards reject older responses. Theme tokens remain unchanged and the picker respects the existing reduced-motion preference.

Planner mutations freeze other writes and week changes from request start. This warning survives focus loss even when a late response is suppressed. An unconfirmed change asks for a fresh plan read and explicit acknowledgement before allowing another change, with a shopping-list link and a warning that timed-out writes can still finish later. Reload is a current view, never proof of failed server execution. No automatic retry or undo is performed. The warning is local/in-memory, not durable offline recovery. Native picker additions and undo additions use the strict reviewed endpoint rather than the older permissive add response.

Shared library reads, week reads, Today idea reads and existing planner writes now have12-second token/network deadlines. This affects their callers on both platforms and needs later timeout regression checks. Native account/session/week isolation from db033b6 remains intact. No schema/provider/dependency changes.

Source-only: no tests/typechecks/build/device/provider/deployment work tonight. Later acceptance must exercise initial failures, stale refreshes, retry ordering, failed library with an empty/nonempty cached collection, writes across blur/account/week changes, timeout with eventual commit, explicit acknowledgement, quantity-preserving shopping recovery, reduced motion and actual native accessibility. Linear SSE145 still requires reauthentication; no completion or comment claimed. Existing main/runtime/installed apps and receipt/review recovery remain unchanged.

### Overnight web planner recovery parity

Web planner private state is now keyed to the verified Clerk session and receives a client with the initiating-session comparison header. Explicit sign-in/loading recovery is shown, and the server passes its actual Clerk configuration for the existing keyless development mode. Earlier keyless/session behavior still needs validation; no authentication/provider settings changed.

Existing loading UI remains, with edits paused during refresh/failure. Writes have immediate mutation guards, freeze week navigation and further changes, invalidate earlier plan reads and suppress unmounted/account-replaced feedback. Unconfirmed results require a new plan view and deliberate review acknowledgement; suggestion responses also require the suggestion view. A failed optional suggestion read does not block recovery from an unrelated plan/list mutation. Requests may still commit after timeout; reload is not proof of failure. No automatic resend/undo, durable local queue or offline-save claim. Suggestion loading/failure is visible and recoverable instead of silently implying none. Shared suggestion reads/responses now use12-second deadlines.

Web picker additions/undo use the strict reviewed endpoint. Drag moves accept only a bounded1024-character well-formed source recipe/date/slot that is present in the displayed plan; they respect read/write readiness. The previous planner-only suggestion panel is no longer mounted by PlanWeek: a themed link leads to Today, which retains the selected recipe and explicit date/slot/missing-item review. Its old component source remains preserved. The This week control now uses Monday weekStart rather than today's raw date.

General planner GET/POST and pending-suggestion GET/response explicitly return private/no-store and content-free unexpected errors. General planner/response POST bodies are bounded after authentication; response actions must be accept/dismiss. Legacy general planner date/action fallback semantics otherwise remain unchanged and are a later contract review, not claimed hardened validation. No DB/schema/provider/dependency changes.

All changes are source-only: no tests/typechecks/build/browser/device/provider/deployment tonight. Later acceptance must cover signed-in/out/keyless/loading/expired and A-B-A sessions, failed refresh locks, strict adds, same-week source drag checks, uncertain list/plan/suggestion writes, stale reads, optional suggestion failure, keyboard/dialog focus/theme layouts and selected-week routing. Main/installed apps/recovery branches are unchanged; Linear SSE145 reauthentication persists with no tracker status/comment update claimed.

### Overnight planner contract and move-transaction correction

Source inspection found that the general planner silently turned missing/invalid dates and slots into today/dinner, while JavaScript date parsing could normalize an impossible date. General plan writes now use a shared discriminated action parser: known action, saved-recipe ID shape, exact real2000–2100 calendar dates and explicit meal slots. Add/remove/move derive the response week from the chosen date only when week is omitted; an explicitly malformed week is rejected. Clear-week and plan-to-list require a chosen week. Unknown fields are ignored, but malformed actions no longer succeed as no-ops. The general week GET rejects malformed/repeated week parameters instead of selecting a different week. Shared isISODate now verifies round-trip calendar equality, so impossible dates are not accepted by other callers either.

The existing database move helper had an ownership/source gap: it inserted the destination without checking owned recipe/source membership, and identical source/destination could delete a meal. It now checks recipe ownership inside the existing transaction, locks the exact source row, treats same-location moves as no-ops, and inserts/deletes only with a real source. If the source is absent, it creates nothing; an already-existing exact destination can confirm a no-op retry. Conflicting concurrent moves need later real transaction tests. The route checks the returned boolean and does not claim an unavailable move succeeded. Transaction rollback/fault injection, row-lock behavior and same-location/idempotent/cross-account cases are unvalidated tonight.

Friend-suggestion POST now authenticates before a bounded2048byte body, requires reviewed recipe/date/slot and a bounded recipient identifier, and returns private/no-store/content-free errors. Existing friend/visibility authorization remains in the database helper. No actual suggestion/message/invitation was sent.

This increment intentionally changes malformed legacy planner requests from fallback/no-op success to400; valid existing client calls retain their fields. No schema/dependency/provider/runtime change. Source-only: no tests/typechecks/builds/DB fixtures/provider/deployment work. Later acceptance must cover all action variants, omitted versus invalid weeks, leap/month overflow dates, source/destination duplicates, fault-injected rollback, two concurrent moves, stale/deleted/nonowned recipes, friend visibility and existing shared date-helper callers. Linear SSE145 reauthentication persists; tracker completion not claimed. Main, recovery worktrees/branches and installed apps remain unchanged.

### Overnight ingredient-led meal choice

Current official competitor review found ingredient-driven search and exclusions in SuperCook's publisher listing (https://apps.apple.com/us/app/supercook-recipe-by-ingredient/id1477747816) and Food List/expiry-priority recipe search in Samsung Food's own Food+ promotion (https://samsungfood.com/foodplus-promo/). These are comparison points, not claims that Savortome has their provider, nutrition or inventory integrations.

Today now has optional Use this ingredient and Skip this ingredient today fields on web and mobile. They apply to this request only, require a separate Show me some ideas action, clear stale choices when edited, and remain locked while a shopping/plan outcome is unconfirmed. They never edit pantry inventory, allergies, dietary profile, food notes or plans. One bounded name per field is accepted; comma/semicolon lists, alternatives, control characters, empty normalized names, unsupported limits and duplicate known query fields are rejected. Blank choices mean no ingredient filter. The UI displays the actual normalized matching names with results, including empty results.

The shared parser normalizes once with the existing pantry canonicalizer; ranker inputs are parser-normalized, avoiding a second singularization. Required and excluded names are checked against the full saved ingredient index, including staples/optional ingredients. Database filters run before the existing40-candidate cap and the deterministic ranker enforces them again before selecting at most3. Conflicting use/skip names yield no ideas, never a relaxed fallback. All selected time/no-shopping/strict dietary and detected-allergen filters still apply. A listed optional ingredient may not actually be used; names do not prove preparation, quantities, hidden ingredients, complete indexing, exact aliases or allergy safety. The saved pantry may be stale, and a use request does not claim possession.

The shared client now sends read-only planning choices as POST JSON rather than URL parameters. The route authenticates before a bounded2048-byte body, strictly checks known field types, ignores unknown fields, and retains private/no-store plus content-free unexpected errors and existing account/session pinning. Existing GET remains for prior clients. No body logging/telemetry was added; this does not prove third-party infrastructure log retention. No schema, migration, dependency, provider enablement, inventory/customer-data mutation, notification or gamification change.

Source-only, per James: no tests/typechecks/builds/provider calls/device/browser/deployment tonight. Later acceptance: raw versus normalized names, non-idempotent canonicalization words, malformed/repeated/oversized fields, required optional/staple ingredients, incomplete indexes, contradictory choices, exact exclusion versus allergen filtering, pre-cap owner isolation, old GET/new POST compatibility, expired/A-B-A sessions, failed reads, uncertain action locks, enlarged text/theme/keyboard/native labels. Linear SSE145 still requires reauthentication; no tracker status/comment update or installed-app change is claimed.
