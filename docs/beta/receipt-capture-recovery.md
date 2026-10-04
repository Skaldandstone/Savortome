# Receipt capture recovery

Reviewed 2026-10-03 under SSE-144. Savortome remains the product; Second Breakfast is a mode.

The mobile receipt card previously disappeared while checking availability and treated a failed request as a disabled feature. Camera permission requests also ran outside error recovery. This made network/account problems look like missing functionality and could leave the action without useful feedback.

The card now distinguishes loading, server-disabled, available and failed checks. Failed or stalled checks offer retry after at most 12 seconds. Responses from timed-out or abandoned checks cannot replace a newer result. Camera permission failures remain recoverable, the photo alternative stays available, and both actions disable while capture is pending. A rejected receipt write explicitly says it was not saved for review. Raw provider/native errors are not displayed. Successful scanning still creates a review only; it never claims inventory was added.

## Evidence

- `node scripts/check-mobile-receipts.mjs`: 13 actual-component cases using synthetic API/camera boundaries.
- `node scripts/check-mobile-account-startup.mjs`: 5 passed.
- `node scripts/check-mobile-sentry.mjs`: 4 passed.
- `node scripts/check-woodland-ui.mjs`: 49 passed.
- `node apps/mobile/node_modules/typescript/bin/tsc --noEmit -p apps/mobile/tsconfig.json`: passed.
- Browser fixture rendered the actual ReceiptCapture body with web primitives and synthetic API/camera responses. Visually inspected the failure message, activated retry, observed both capture choices, and activated simulated camera denial; the photo alternative remained available. This is copy/recovery rendering, not native layout or camera acceptance. Fixture stays ignored under `.local/receipt-recovery/`.

## Remaining acceptance

No APK, OTA, provider configuration, account, database or runtime was changed for this slice. The existing Android 0.1.4/code5 artifact predates it. A future approved mobile delivery and physical signed-in tablet pass must exercise real capability checks, receipt upload, review and permission states. No ADB device was connected during this session. Enlarged-text, screen-reader and narrow native layout checks remain open.

At refresh, main matched origin/main at abf335f and all three latest CI runs passed; no open PRs preceded this work. SSE-144 was read through authenticated Chrome because the Linear connector required reauthentication. The signed-out production `/discover` probe returned HTTP 503; no runtime availability or scheduled scale-state claim follows from that response. Clerk Native API remained enabled in a read-only check; no full tablet login was verified. Do not change provider/legal/pricing/account state to close these acceptance gates.
