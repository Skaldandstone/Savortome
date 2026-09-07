# Web accessibility continuation

Recorded 31 August 2026 after the completed woodland UI pass. This checkpoint
adds source and rendered-component safeguards; it does not claim browser,
screen-reader or owner visual acceptance.

The subsequent native pass and fresh ARM64 guest artifact are recorded in
[mobile-accessibility-continuation.md](mobile-accessibility-continuation.md).

## Changes

- Friend meal suggestions now name the friend, date and meal-slot controls.
  Allergy loading uses polite status, while unavailable checks, detected
  conflicts and failed writes use alerts.
- Pairing choices name the recipe and course they include. Meal naming no
  longer relies on placeholder text. Pairing success and failure are announced
  with the appropriate status.
- New-shelf naming has an explicit accessible name.
- Cooking timers expose a named region and every pause, resume, reset and clear
  action includes the timer label and originating step. The countdown remains
  outside a per-second live region.
- Nutrition and checkout failures are announced as alerts without changing
  their server behavior or availability.
- `scripts/check-web-accessibility-source.mjs` parses all web TSX source and
  fails on unnamed native inputs, selects, textareas, buttons, images, iframes
  and dialogs. It includes fixtures proving that the checker catches missing
  names while permitting labels, explicit ARIA names and hidden inputs.

## Verification

| Check | Result |
| --- | --- |
| Rendered component, authorization, library and image boundary tests | 37 passed |
| Accessibility source audit | 94 TSX files, zero findings |
| Web TypeScript | Passed |
| Offline privacy and generated-source parity | 10 passed |
| Production web build | Passed, 35 prerendered pages |
| Build ID | `GRhfwCcQhEsHyFoXqVJvT` |
| Source whitespace check | Passed |

The current source was sealed as snapshot commit
`69b72d197d7d20dd10ba293b73e16e792f0e5114`, manifest SHA-256
`f9db46eab22bbecbb1e2405640cd255e3d57c705af8601ba675f1bd3594fe693`
and archive SHA-256
`5e1689d307fc0b205fbfd2e6bf564fc639566a0e2515cd43c88a1a73bb2c35cb`.
The 592-entry ZIP has no bad or duplicate paths, and the real Git index was not
changed. A new private container and scan are separate evidence.

The first root-directed Next CLI build compiled the application but failed its
type-validation worker because that invocation did not resolve the web
workspace's `@types/node`. Running the installed Next CLI from `apps/web`, the
actual workspace context used by its package script, passed. Both logs are
retained in `docs/beta/checks/`.

## Skillet icon reconciliation

PR #38 at `aa5d2da4a2f9d34d26b8308566b1f2be06f34c18` was reviewed rather than merged
blindly. The icon generator and all nine raster outputs in the current tree are
exact Git-blob matches to that commit. The two configuration files have later
reviewed privacy and woodland changes while retaining the maskable icon and
skillet identity. Raster inspection confirms the Apple icon is fully opaque
and the maskable mark remains inside the middle 66 percent safe area. Evidence
is in `checks/skillet-pr38-reconciliation.json` and
`checks/skillet-pr38-raster-audit.json`.

## Remaining acceptance

The explicit browser URL-policy block remains in force. These checks do not
establish computed styles, browser zoom, keyboard traversal, native screen
reader behavior, touch behavior, visual quality, invited-account behavior or
device acceptance. Those remain runtime gates. The previously scanned private
container predates this source checkpoint and must not be described as carrying
these changes.
