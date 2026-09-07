# Overnight integration, 31 August 2026

Latest daytime continuation after renewed web UI authorization:
[web-ui-integration.md](web-ui-integration.md), build `RHF3PnWQrDsVQJjkCCXDQ`.
The prior web output below is historical; billing/native evidence is preserved.

Later image-security follow-up: [image-parser-security.md](image-parser-security.md)
supersedes this report's web configuration/build identity with
`JU_bSJRJvJgnvh6kH4QVX`. Only the unused optimizer configuration changed; all billing,
native source and original/account/guest APK evidence below remains applicable.
The original web build logs/fingerprint are historical, not the current output.

Canonical checkout: `C:\Users\James\Documents\GitHub\SecondBreakfast`, branch
`codex/whimsical-private-beta`, base `dcb6f71`. Changes remain uncommitted for
deliberate review alongside existing sibling and legal work. No deployment,
distribution, live billing, OAuth grant, invitation or new service occurred.

## Billing implementation

The existing hosted Checkout/portal integration is extended with actual catalog
and customer ownership checks. Each configured Price must match this product's
tag, amount, USD currency, environment and annual/one-time cadence. Duplicate
Price configuration is unavailable. Customer metadata is checked at Checkout,
portal and fulfillment. No browser-supplied Price, Customer, user or amount can
authorize a purchase. Production redirects require an HTTPS origin. Adaptive
pricing is explicitly off because the existing ledger stores USD cents only.

Webhook signature verification uses the unchanged request body. Claim, purchase,
grant and subscription state share a transaction. A per-account row lock precedes
the current Stripe object read, so delayed snapshots do not overwrite later state.
Only the linked subscription can update that account; old cancellation events and
duplicate old Checkout events cannot replace it. Current expanded Price selects
the tier, not metadata. Unsupported catalog entries grant no paid tier. Unpaid or
paused identity is retained for recovery; existing past-due grace is unchanged.

Checkout refuses a second nonterminal subscription, checks pending subscriptions
even before their webhook arrives, and reuses a matching open Checkout. Initial
Customer creation uses a stable owner-scoped idempotency key. Invalid state rolls
back and can retry; SDK/customer payloads are excluded from route error logs.

Source: `apps/web/lib/stripe-policy.ts`, `stripe-fulfillment.ts`, `stripe.ts`,
`apps/web/app/api/billing/{checkout,portal,webhook}/route.ts`,
`packages/db/src/queries/billing.ts`. Setup and exact configuration expectations
are in [STRIPE_SETUP.md](../STRIPE_SETUP.md). No schema migration or package change
was needed. Existing source prices are preserved, not new commercial approval.

The connector's reauthentication blocker remains. Current official webhook and
subscription documentation was read through Stripe CLI 1.50.6; no authenticated
Stripe API requests or objects were created. Tax registrations, product tax codes
and tax-inclusive/exclusive treatment need owner/adviser review. Automatic tax is
absent; no tax readiness is claimed. Refunds/disputes and historical unmarked or
partially fulfilled records remain explicit paid-release reconciliation work.

## Android concept parity

Mobile now uses byte-identical WebP assets from the rebuilt web concept. Library
uses the illustrated kitchen scene, actual photo rows or neutral journal art,
shelf counts and a wider two-column layout. Text and all controls remain native.
No recipe is classified to infer a food illustration. Care has compact expandable
cards; all three slots expose their exact ingredients and steps, including Future
me. Reduced decoration and enlarged text suppress food artwork without removing
content. Cooking/recipe reading panels use subtle parchment with dark ink, and
the labeled native line-icon dock wraps when text is enlarged.

Care routing, account-token pinning, local restrictions, sign-in selection and
single-item shopping protections are preserved. Guest support still requires no
profile or pantry API read. Cook-mode ingredient clipping was removed and step
scrolling now honors reduced motion. Native appearance follows the device's
light/dark setting. There is no new mascot or completion event.

The build recipe can give a new artifact a distinct filename, preserving the old
review APK. It hashes the public build configuration into the Gradle bundle task's
inputs so switching guest/account builds cannot silently reuse a stale bundle.
No SDK, dependency, lockfile, signing-key or canonical Wispling change was made.
The native source is frozen during the build, with 161 hashes recorded in
`checks/overnight-android-source-manifest.json`.

Source: `apps/mobile/modules/woodland/{Artwork,KitchenIcon,KitchenWelcome}.tsx`,
`modules/care/{CareScreen,CareIdeaCard}.tsx`, `modules/library/LibraryScreen.tsx`,
`modules/recipe/{RecipeCard,RecipeHeader,IngredientList,StepList}.tsx`,
`modules/cook/CookScreen.tsx`, `ui/{theme,ThemeProvider,Button}.tsx` (theme is `.ts`),
`app/(protected)/(tabs)/_layout.tsx`, four `assets/woodland/*.webp`, and the existing
review-build PowerShell/Gradle scripts. Legal links and screens are preserved.

## Verified checks so far

| Check | Result | Evidence |
| --- | --- | --- |
| Core suite | 551 tests passed | [log](checks/overnight-core-suite.txt) |
| Core, DB, web, mobile TypeScript | All four passed | `checks/overnight-{core,db,web,mobile}-typecheck.txt` |
| Actual billing routes, signature verifier and PGlite | 33 scenarios, 34 Node tests passed | [log](checks/overnight-stripe-lifecycle.txt) |
| Real disposable PostgreSQL billing | 6 scenarios passed, including two-connection locking | [log](checks/overnight-stripe-postgres.txt) |
| Care/sign-in/save/link helpers | 13 passed | [log](checks/overnight-care-helpers.txt) |
| Actual gate/library/report plus native component contracts | 22 passed | [log](checks/overnight-boundaries-ui.txt) |
| Native art/contrast/contracts only | 9 passed | [log](checks/overnight-mobile-woodland.txt) |
| PR #38 icon reconciliation | All nine bitmaps and generator exactly match PR head | [hashes](checks/overnight-pr38-reconciliation.json) |
| Original PGlite billing regression | Passed again after pending-ledger owner/product checks | [log](checks/overnight-stripe-original-regression.txt) |
| Release safeguards | 56 mocked assertions passed again | [log](checks/overnight-release-mocks.txt) |

Pending purchase recovery also verifies the existing ledger owner, product,
amount, credits and tier before granting. It cannot adopt a conflicting historical
Session row. A fault-injected route regression verifies rollback on mismatches.

## New Android review artifacts

Both APKs are arm64-v8a, `com.secondbreakfast.app`, version 0.1.0/code 1, minimum
SDK 24 and target 36. Both passed apksigner v2 verification with Android Debug
certificate SHA256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
They are local review builds, not cohort signing or installation acceptance.

| Configuration | File under `apps/mobile/.expo-export` | Size | SHA256 |
| --- | --- | ---: | --- |
| Account preview | `account-preview/second-breakfast-arm64-woodland-review.apk` | 58,536,845 bytes | `1677bb302e8e9a7054df391182a9b6517d181c74ca2160b75b792a8d09f201cf` |
| Guest preview | `guest-preview/second-breakfast-arm64-woodland-guest.apk` | 58,536,253 bytes | `9dda3582dbb846c00ca29f57805f60114417bd6fb9b94cb0ade31e68ee719293` |

Build times were 4m 2s and 1m 57s. The guest build reran the bundle task after the
configuration changed. Packaged code contains the new care/woodland text and
guard messages; actual local Clerk test-key presence was checked as a boolean
(present for account, absent for guest), without printing the key. Both contain
the exact four WebP assets and match all 161 frozen source hashes. The original
`second-breakfast-arm64-review.apk` remains unchanged at SHA256 `b828dcf86cbba709d0fc1905a38e5cf1495cb8acd789e4c2357aae0fe4d82957`.
Neither new APK has been installed. `adb devices -l` returned no devices.

Machine-readable evidence: [account manifest](checks/overnight-android-account-artifact.json)
and [guest manifest](checks/overnight-android-guest-artifact.json), with separate
`checks/overnight-android-{account,guest}-{build,signing,badging}.txt` logs.

Repeat from the canonical repository root in a fresh PowerShell process:

```powershell
powershell.exe -NoProfile -File apps/mobile/scripts/build-android-review.ps1 -Configuration account-preview -SkipPrebuild -JavaHome 'C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot' -AndroidHome 'C:\Users\James\AppData\Local\Android\Sdk' -NinjaExecutable 'C:\Users\James\.sb-native\tools\ninja-1.13.2\ninja.exe' -ArtifactName 'second-breakfast-arm64-woodland-review.apk'
powershell.exe -NoProfile -File apps/mobile/scripts/build-android-review.ps1 -Configuration guest-preview -SkipPrebuild -JavaHome 'C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot' -AndroidHome 'C:\Users\James\AppData\Local\Android\Sdk' -NinjaExecutable 'C:\Users\James\.sb-native\tools\ninja-1.13.2\ninja.exe' -ArtifactName 'second-breakfast-arm64-woodland-guest.apk'
```

The existing API-origin default names the prior hosted service, whose candidate
revision is unverified. Guest care does not need that service; do not claim the
account APK's saved-profile/shopping integration works against the new candidate.

The first billing harness failed because its unnecessary core-barrel bundle
initialized an SDK in a VM without its globals. The harness now imports the real
billing module directly; its failure is retained in
`checks/overnight-stripe-lifecycle-harness-failure.txt`. Initial native typecheck
identified unsupported RN Image pointer props/removed StyleSheet alias; these
were corrected to inert View wrappers and the installed RN API, then passed.
PostgreSQL emits an existing concurrent-query deprecation warning; all six real
SQL scenarios exit 0. No pg upgrade or unrelated credits-query rewrite was made.

## Remaining gates

Final local production web build succeeded, including type validation and all 35
prerendered pages; `/care` remains dynamic. Build ID: `8SppsANVHSszqZHJ20R5P`.
The build deliberately had no Clerk/database/paid-integration credentials, beta
access off and service-worker compilation on. It is not an invited-account image.
The generated offline/privacy parity suite passed all ten tests afterward. See
[build log](checks/overnight-web-production-build.txt),
[offline log](checks/overnight-offline-final.txt) and
[source/artifact fingerprint](checks/overnight-review-manifest.json).

All planned safe local implementation/build work in this continuation is
checkpointed. No Gradle or web production build remains active. Prior web build
logs/fingerprints are retained as history; `.next-build` now contains this revision.

- Native packages and web compilation are verified above. Earlier screenshots
  do not prove this source revision.
- Explicit browser URL-policy denial remains binding. No retry, alternate host,
  browser or rendering workaround was used. No new running-UI visual acceptance.
- No emulator or physical device is available. Debug signing is local review only.
  TalkBack, keyboard/font-size behavior, both themes, account switching, actual
  failed writes and bidirectional OS handoff still require runtime testing.
- Current-alpha Wispling handoff is not integrated. The legacy patch/proposal and
  its boundary are in [handoff-evidence.md](handoff-evidence.md).
- The cloud coordinator reports company development target `734702670689`,
  profile `skaldandstone-dev`, `us-east-2`, with no Second Breakfast runtime.
  `574921529762` is the prior deployment account. No release config is retargeted
  automatically; reviewed source, actual identity/revision and privacy-v3 rollback
  proof remain required. No account response may be restored to broad caching.
- Owner supplies invited Clerk IDs and reviewed installation/feedback destination,
  approves usability/safety/signing, and reauthenticates the exact Stripe sandbox
  before any sandbox setup or hosted tests. Checkout/live mode stay disabled.
