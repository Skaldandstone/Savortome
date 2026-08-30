# Integrated beta status

30 August 2026. Canonical source: `C:\Users\James\Documents\GitHub\SecondBreakfast`, branch `codex/whimsical-private-beta`. This is a local review candidate, not a cohort release. The four parallel tasks and their exact ownership remain recorded in `COORDINATION.md`.

## Working implementation

The kitchen visual system uses separate raster scenes/props/icons and native controls. Care has a shared curated ranker, strict choices, detected-allergen exclusion with explicit matching limits, guest native access, temporary local settings, honest shopping feedback and a restricted handoff protocol. Hosted care uses the server Clerk allowlist. The revised worker stores public resources and a synthetic generic offline document; no public online HTML page bypasses care authorization.

Recipe/index and billing changes now use real database transactions. Effective-host TLS parsing cannot use a localhost authority to conceal a remote query override. The Stripe source handoff is integrated, including disabled paid controls and atomic, deduplicated fulfillment. Checkout and live mode remain off. No live integrations, cloud resources or tester invitations were created.

## Combined checks completed

| Check | Result | Evidence |
| --- | --- | --- |
| Core suite after Stripe and offline integration | 551 passing tests | `checks/integrated-core-tests.txt` |
| Core, database, web and mobile typechecks | All four passed after Expo dependency pins | `checks/integrated-typecheck-summary.txt` and per-workspace logs |
| Web/mobile care, save and link helpers | 12 passed at this snapshot | `checks/integrated-care-ui-tests.txt`; native lane has since added another regression |
| Actual web gate/page and image-report code with mocked boundaries | 9 passed | `checks/integrated-authorization-image-tests.txt` |
| Actual release script with mocked AWS/Docker boundaries | 56 assertions passed | `checks/integrated-release-tests.txt` |
| Existing disposable database suites | 335 assertions in 15 suites | `care-data-evidence.md` and `checks/care-data-summary.json` |
| Recipe/index rollback and account isolation | 10 scenarios passed | `checks/care-data-transactions.txt` |
| Billing rollback and actual multi-connection PostgreSQL locking | 5 scenarios passed; old-code regression reproduced first | `stripe-integration-evidence.md` |
| Isolated and integrated PGlite billing test | Passed | `stripe-integration-evidence.md` |
| Worker v3 browser install/update/offline/strict no-match | Passed with synthetic identities and failed-network simulation | `web-evidence.md`, `readiness-evidence.md` |

Counts apply to the named runs. They do not imply authenticated Clerk, production RDS, physical airplane mode, OS app dispatch, accessibility certification or device validation. Production web and final Android artifacts are still being finished by integration/native at this writing.

After the web lane's handoff, integration also applied the existing bounded-request wrapper to care shopping writes. A response that never arrives now becomes unconfirmed after 12 seconds instead of leaving the button busy indefinitely. The request is not automatically retried or called unsaved; it might have committed. The web typecheck passed again. Browser validation of that case remains part of the blocked real-session checks.

## Review material

- [Concept board](../../design/concepts/woodland-beta-board.png) and [optional Wispling visitor comparison](../../design/concepts/wispling-visitor-comparison.png). The beta has no character by default.
- [Wide kitchen library](web-library-desktop-dark.jpg), [care at 200 percent text](web-care-narrow-light-200.jpg), and [cook at 200 percent text](web-cook-narrow-dark-200.jpg). See the web report for which changes came after each capture.
- [Web evidence](web-evidence.md), [Android evidence](android-evidence.md), [care/data evidence](care-data-evidence.md), [privacy/release evidence](readiness-evidence.md), and [Stripe review](stripe-integration-evidence.md).
- [Tester guide](tester-guide.md) and [enrollment, removal, release and rollback runbook](release-runbook.md).

Browser screenshot file signatures were checked. The six earlier `care-*`/`cook-runtime` captures also contained JPEG bytes, so their extensions were corrected to `.jpg` without changing the images. The concept and production PNG artwork is separate.

## Unfinished release gates

1. The final APK/build/signing and device checks are not complete. Exact Expo-compatible Worklets/Reanimated pins fixed a demonstrated dependency mismatch; the current arm64 native retry follows the documented Windows path workaround. A debug-keystore APK is review-only, not a distribution approval. No emulator or physical-device validation is claimed.
2. Real Clerk sign-in/invitation, expiration, account switching and authenticated failed-write checks remain. Browser URL policy explicitly denied the last app reload; no retry or alternate-access workaround was attempted. Remaining post-fix forms/plans screenshots and accessibility checks await permitted browser access.
3. Wispling's isolated handoff targets the legacy baseline. The active alpha entry selects `src/alpha/AlphaApp`, where those legacy routes are unreachable, and that alpha milestone explicitly excludes this integration. The tested legacy patch and an active-alpha adaptation proposal are available, but no alpha changes or complete current-alpha handoff are claimed. See `handoff-evidence.md`. OS-level two-app tests also remain.
4. AWS authentication remains expired on a fresh identity check. Current deployed revision, scale-down state, reviewed image provenance and a privacy-hardened rollback image are unverified. A privacy-only bridge release may be needed so automatic rollback cannot restore the old cache defect.
5. Final source review, approved signing, usability/safety review, a private manual feedback destination and consenting testers' Clerk IDs are required before rollout. Stripe sandbox identity/catalog remain unverified and checkout stays off. Public release is outside this pass.

No permission is needed to continue ordinary local implementation. The release gates above require actual evidence or external access; they are not satisfied by compilation or mock tests.
