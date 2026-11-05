# Grocery review recovery

SSE-144, reviewed 2026-10-03. This is a distinct slice from receipt capture: it covers confirmation and recovery for existing pending grocery/receipt reviews on both web and mobile. Savortome is the product; Second Breakfast remains a mode.

Previously, Dismiss wrote immediately. An unexpected thrown write left controls busy, while a returned false offered no feedback inside the card. The new confirmation lets someone keep reviewing without losing their selection. Failed or unconfirmed writes preserve checked items, restore controls, and announce that the save could not be confirmed. Because a lost response may follow a server-side write, the copy asks users to check their pantry before retrying rather than asserting that nothing changed. Raw provider text is not rendered. Successful responses disable duplicate actions while the parent removes the resolved card. The web cancellation returns focus to Dismiss.

## Checks actually run

- `node scripts/check-pantry-review-recovery.mjs`: 14 actual-component cases across web/mobile with synthetic React/write boundaries; confirmation/cancel, exact selected IDs, rejected/thrown writes, pending controls, retry, successful dismissal/addition and empty selection.
- `node scripts/check-woodland-ui.mjs`: 49 passed.
- `node apps/web/node_modules/typescript/bin/tsc --noEmit -p apps/web/tsconfig.json`: passed.
- `node apps/mobile/node_modules/typescript/bin/tsc --noEmit -p apps/mobile/tsconfig.json`: passed.
- `git diff --check`: passed.
- Browser rendered the actual web card and Button/CSS in a synthetic 390px content fixture at 200% text. Unchecked bananas, opened dismissal confirmation, cancelled, verified Dismiss focus and retained oats selection, simulated an unconfirmed add, then retried to success. Final alert/status and disabled controls matched responses. Local fixture is ignored under `.local/pantry-review/`; this is not a signed-in hosted write, screen-reader run, physical device or native-layout acceptance.

## Existing receipt checkpoint and remaining gates

PR124, receipt capture recovery commit64fc36d, reached a terminal green result in [CI run37112037624](https://github.com/Skaldandstone/Savortome/actions/runs/37112037624): Typecheck/unit54s, Database1m6s, End-to-end2m41s. It remains an unmerged, remotely preserved review checkpoint. This branch starts separately from mainabf335f; both PRs add CI checks near the same section, so integration must retain both test steps.

Neither slice changes provider/account/legal/pricing state, database behavior, production runtime, APK or OTA. Installed Android0.1.4/code5 predates both. No device was connected. Future mobile delivery must verify real permission/capture/upload/review, complete hosted tablet auth, and test assistive technology and native enlarged text. Existing hosted503 and signed-in/account-switch acceptance remain separate gaps; do not infer runtime availability from CI.
