# Food-support validation checkpoint

October 4, 2026 day-run. Baseline `733d1f1`, plus the native meal-date label fix and new regression script in this checkpoint. The overnight implementation remains a feature branch, not a deployment or installed update.

## Checks actually run

- All four workspace TypeScript checks passed via direct installed TypeScript, with no dependency install. Mobile initially failed because PlanIdeaReview passed unsupported `label` to Field; fixed with visible Text plus accessibilityLabel and reran successfully.
- Core suite: 695 tests passed, zero failures. Local output: `.local/assistant-history/day-core-tests-2026-10-04.txt` (ignored).
- `node --import ./packages/db/node_modules/tsx/dist/loader.mjs scripts/check-food-note-recovery.mjs`: 11 tests passed. Uses real query functions and disposable in-memory PGlite, never a production database.
- `node scripts/check-mobile-receipts.mjs`: 13 actual-component tests passed with synthetic camera/API boundaries.
- `node scripts/check-pantry-review-recovery.mjs`: 14 actual-component tests passed with synthetic API boundaries.
- Source whitespace review passed. These checks do not establish rendered browser/device accessibility or installation.

## Food-note fixture coverage

New note/exact receipt; unchanged stable-ID retry without revision bump; different unversioned retry refusal; accepted reviewed edit and unchanged retry; old create/stale different edit cannot overwrite; same note ID across separate owners and isolated deletion; caller transaction rollback after nested edit/deletion; increasing rapid-edit revisions; idempotent deletion and no resurrection by an old edit; malformed/different receipt refusal. The fixture also positively reproduces the documented unresolved lifecycle: a new-note retry after deletion can recreate its ID without a tombstone.

PGlite verifies query/transaction behavior in one disposable engine, not multi-connection PostgreSQL lock contention, production migrations, hosted sessions or physical devices. The fixture creates only the relevant tables; it is not a full migration acceptance run. The regression script is separate from the core test glob and must be invoked explicitly until CI wiring is deliberately added.

## Remaining acceptance

Actual Today components need delayed/focus/session/unmount tests for immutable save/delete recovery, capture permissions and background cleanup, receipt/account ownership and unchanged consent/provider-disabled states. Verify disposable migrations and multi-connection concurrency; review old-client changed-edit rejection and durable/deleted-new-note recovery. Then perform browser narrow/wide/themes/enlarged-text/keyboard/screen-reader checks and Android/iPad testing. No heavy build, deployment, provider call, credential/signing change, live customer-data mutation or main merge in this checkpoint. Providers remain disabled pending registration/retention/privacy gates.

Linear SSE145 read returned reauthentication required on this run. Reconnect Linear in Codex to reconcile execution status; no login workaround, tracker closure or Notion update claimed. Recovery PR124/125 refs and both existing CI recovery commands remain preserved.

## Native capture lifecycle follow-up

October 4 renewed day-run, after `f34a364`: `node scripts/check-food-capture-lifecycle.mjs` passes 16 actual-component cases against synthetic recorder, permission, picker, cache-file and API boundaries. It makes no camera/microphone/provider requests and retains no real media. Coverage includes failed/retried/stale availability, consent cancellation, camera/microphone denial, photo-picker AppState handling, stale picker/provider replies after leaving, original-library-file preservation, unsupported media, background cleanup during a pending stop, recorder preparation failure, explicit voice-send failure, the automatic recording limit without automatic upload, and leaving during preparation/file read.

The first run had 12 passes and one demonstrated failure: rejected recorder preparation left `allowsRecording=true`. The component now restores playback mode and discards partial cache media before presenting recovery; all 16 cases subsequently pass. Mobile TypeScript and whitespace checks pass. This script remains an explicit standalone command, not new CI wiring. Physical OS permissions, recorder/route lifecycle and provider retention still require separate acceptance.

Authenticated Chrome read of SSE-145 succeeded in this follow-up; FUTURE-04 and FUTURE-05 remain In Progress. The Linear connector still requires reauthentication, but the current checklist can be read in Chrome. No tracker status, comment or Notion content was changed. Actual Today delayed save/delete/session recovery, full migrations/multi-connection concurrency, rendered accessibility and device checks remain open.
