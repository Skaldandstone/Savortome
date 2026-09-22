# Android beta lane evidence

## Physical-device follow-up, 21 September 2026

The current account-capable ARM64 review APK was installed and exercised on a
Samsung SM-T970 running Android 13. Cold launch, direct and deep-linked guest
Care, offline deterministic suggestions, exact ingredients and ordered steps,
honest signed-out shopping behavior, 150% font scaling, reduced decoration,
portrait lock, and rejection of an untrusted return destination all passed on
the device. The captured app log contained no fatal app exception or React
Native runtime error.

The exact artifact is
`apps/mobile/.expo-export/account-preview/savortome-arm64-physical-review.apk`,
63,003,296 bytes, SHA-256
`9920afc086271d575b7c0618f1531fb7e3fbde7487af24d24c4cacb9907b47c3`.
It is ARM64-only, package `com.skaldandstone.savortome`, and remains signed by
the Android Debug certificate. The final rebuild uses the canonical
`https://savortome.skaldandstone.com` API origin and was reinstalled before a
fresh cold guest-Care launch. Full package, permission, backup, device-state,
and screenshot evidence is in
[physical-device-evidence.md](physical-device-evidence.md).

TalkBack is installed, but its first-run tutorial intercepted traversal. The
device was restored without bypassing that tutorial, so a completed physical
screen-reader pass remains open. Signed-in writes and receipt camera/gallery
capture also remain open because no Savortome account was entered on the test
device. This section supersedes older statements that no physical device was
available, while leaving those dated records intact.

## Accessibility-final ARM64 guest build

The later mobile accessibility continuation is documented in
[mobile-accessibility-continuation.md](mobile-accessibility-continuation.md).
Its full-prebuild guest APK passed package, ABI, signature, backup, permission,
asset, source and configured-key absence audits. It is 56,309,405 bytes with
SHA-256 `f823846a9a531d6278603e22949559b309c18d7c9c81c507fb1d91f87f8c79cc`.
This remains a debug-signed local review artifact with no device or TalkBack
claim. The earlier artifacts below are retained as historical evidence.

## Final hardened ARM64 guest reproducibility build

The final bounded rebuild completed on 31 August 2026 with a full Expo Android
prebuild and `:app:assembleRelease`. It used guest mode, JDK 21, the verified
task-local Ninja 1.13.2, one Gradle worker and `arm64-v8a` only. It performed no
dependency install, provider call or cloud action. Gradle reported `BUILD
SUCCESSFUL` in 11m47s and all Java/Gradle processes exited afterward.

| Property | Verified value |
| --- | --- |
| Artifact | `apps/mobile/.expo-export/guest-preview/second-breakfast-arm64-woodland-guest-final.apk` |
| Size | 56,308,513 bytes |
| SHA-256 | `df3f992c619476e680df4f6f88a7abd32db6ad055f4d2da65afa15f0d717f233` |
| Package | `com.secondbreakfast.app`, version `0.1.0`, code 1 |
| ABI / SDK | `arm64-v8a` only; min SDK 24, target SDK 36 |
| Signature | APK v2; Android Debug certificate, local review only |
| Certificate SHA-256 | `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` |
| Privacy manifest | `allowBackup=false`; `seconds` scheme present; external-storage and overlay permissions absent |
| Guest boundary | Configured local Clerk test key absent from the packaged Hermes bundle |
| Source | 161 approved mobile source paths matched snapshot `87e04ab9e9029a1b86893e8ef4a788de3e77949d`; zero logical mismatches |
| Current source-hash manifest | `89916abf7f55566337963d9df76e30c44a2348436c9ecce5b7776f1150043bee` |
| Dependencies | Three recorded dependency inputs matched; zero drift |

The older raw-hash helper rejected two paths because its manifest predates the
approved `allowBackup`/blocked-permission and architecture-selection edits. A
direct comparison of those files and all other mobile source paths against the
immutable approved source ZIP found identical logical contents after newline
normalization. The failed stale-manifest output is retained rather than hidden.
The final machine-readable audit is
`checks/android-arm64-guest-final-audit.json`; the build log, badging, manifest,
signature and current source hashes are adjacent in `checks/`.

This is compile, package and static inspection evidence only. It does not prove
device behavior, visual quality, accessibility, distribution signing, cohort
installation or release acceptance.

31 August integration addendum: [final-integration-checkpoint.md](final-integration-checkpoint.md)
records the hardened `allowBackup=false` configuration, removed storage and
overlay permissions, distinct x86_64 guest/account artifacts and the rebuilt
arm64 account artifact. The configured emulator could not boot because firmware
virtualization is disabled, so no interaction or accessibility acceptance is
claimed. The older artifact table below remains historical evidence.

Date: 2026-08-30. Work is in canonical `SecondBreakfast`, branch `codex/whimsical-private-beta`. This report separates source checks, packaged artifacts, runtime testing, and distribution approval.

## Implemented

31 August integration follow-up: Android woodland parity source and fresh named
review artifacts are documented in [overnight-integration.md](overnight-integration.md).
The original APK/hash below is preserved and remains prior-revision evidence.
Its file has not been overwritten. Both revisions still require runtime and
physical-device validation; no debug-signed APK is approved for cohort delivery.

- `/care` is outside the protected route group. Account screens and existing application routes retain `AuthGate`; native care can render without an account or network catalogue request.
- The protected account-loading view exposes a labeled, 48-point-minimum link to care, so slow or unavailable Clerk restoration does not hide guest food support. This final change is included in the incremental APK below.
- Preparation preferences are optional and collapsed initially. The bundled curated catalogue produces suggestions immediately. Cards expose ingredients and preparation instructions, matching limitations, and no verified-safe claim. Pantry matching explicitly excludes quantity and preparation guarantees.
- Guest care never requests saved profile/pantry settings. Signed-in settings have an eight-second wait limit and an honest failure state with temporary choices. Guest restrictions selected before sign-in are merged with a successfully loaded saved profile.
- Shopping writes require an account and the button names the single item it adds. The selected idea remains visible through inline sign-in; nothing writes automatically afterward. Rejected or ambiguous writes are never reported saved and are never silently retried. Late responses from a previous account are suppressed. Care API token refresh is pinned to the initiating Clerk account/session so another account's token cannot be acquired during an asynchronous refresh.
- Native care links are normalized before navigation. Only validated documented scalar fields survive; duplicate and unknown fields are discarded. A repeated identical foreground care link reapplies its preparation choices, even after local edits. The only accepted return is `wispling://care-return`. No completion event or choice is sent back.
- Woodland palettes support light/dark system themes. Scene art is separate from native controls. Reduced decoration is locally remembered; native stack transitions observe the system reduced-motion setting. Buttons wrap rather than forcing wide labels off-screen.

## Source validation

| Check | Result | Evidence |
| --- | --- | --- |
| Mobile TypeScript | Passed | `checks/android-typecheck.txt` |
| Mobile care behavioral tests | 9 passed | `checks/android-care-tests.txt` |
| PowerShell build recipe parser | Passed | `build-android-review.ps1` parsed with the PowerShell AST parser |
| Generated Android manifest | Inspected | `seconds` VIEW/BROWSABLE scheme and Clerk hosted callback present |
| Native raster assets | Visually inspected as image files | Character-free kitchen scene and kettle/journal decoration; not a rendered-screen check |
| Runtime, TalkBack, hardware keyboard, font scaling | Not run on Android | Device limitations below |

Tests cover guest write prevention, acknowledged authenticated write, session expiry, failed network request without automatic retry, late responses after account switching, account-pinned asynchronous token refresh, a hung write becoming unconfirmed after a bounded wait, malformed/duplicate/private link fields, fixed return, and preservation of unrelated app routes. These pure tests do not prove a live Clerk session or shopping API integration. A timed-out request may have reached the server, so the interface explicitly asks the user to check the list before retrying; it does not claim cancellation or absence of a write.

Repeat from the repository root:

```powershell
node ./apps/mobile/node_modules/typescript/bin/tsc --noEmit -p apps/mobile/tsconfig.json
node --import ./packages/core/node_modules/tsx/dist/loader.mjs --test apps/mobile/test/care-save.test.mjs apps/mobile/test/care-links.test.mjs
```

## Native build diagnosis and opt-in recipe

The host has JDK 21.0.12, Android SDK build tools 36.0.0, NDK 27.1.12297006, and CMake 3.22.1. JDK 25 previously stalled Kotlin daemon discovery. Native attempts use JDK 21, in-process Kotlin, one Gradle worker, 1.5 GB Java heap, and arm64-v8a only. These are host-specific observations, not universal prerequisites or an emulator fix.

1. The original resumed build failed with Ninja `manifest 'build.ninja' still dirty after 100 tries`. Deep pnpm CMake/Prefab paths exceeded Windows tool limits. See `checks/android-lane-build.txt` and `android-ninja-explain.txt`.
2. `windows-native.init.gradle` moved only generated CMake/Prefab staging into a short, checkout-specific directory. Worklets then compiled. Reanimated exposed the SDK Ninja 1.10.2 limit: `Filename longer than 260 characters`. See `checks/android-short-path-build.txt`.
3. A task-local Ninja 1.13.2 binary was downloaded from the [official release](https://github.com/ninja-build/ninja/releases/tag/v1.13.2), with the downloaded ZIP SHA-256 checked against GitHub release metadata: `07fc8261b42b20e71d1720b39068c2e14ffcee6396b76fb7a795fb460b78dc65`. The SDK binary was not overwritten. An initial Groovy string-type error in the opt-in argument was corrected before retry. See `checks/android-ninja-upgrade-build.txt` and `android-review-build.txt`.
4. With the corrected script, Worklets, Reanimated and app CMake compiled. The build then failed in `expo-modules-core` after 7m14s: `WorkletRuntime` has no member `executeSync`. Expo 57's installed native version manifest specifies Worklets 0.10.1 and Reanimated 4.5.1; the auto-resolved graph had Worklets 0.12.1/Reanimated 4.6.0. This is a dependency mismatch, not an emulator or Windows path failure. The exact SDK-compatible pins were sent to the parent for a coordinated manifest/lockfile fix before retry.
5. The parent approved exclusive manifest/lockfile ownership for those exact pins. `pnpm --filter @seconds/mobile add --save-exact react-native-worklets@0.10.1 react-native-reanimated@4.5.1` completed in 33.7s, relinking +52/-66 packages in the peer graph. Installed versions were verified; existing Expo/system-ui and Stripe/PGlite/Drizzle/esbuild changes were preserved. See `checks/android-sdk-pin-install.txt`. A fresh prebuild and arm64 build succeeded in 28m44s (660 tasks) in `checks/android-pinned-sdk-build.txt`.
6. That first successful APK was 51,258,657 bytes, SHA-256 `a20eb8fbb32e710e325cb78297eb72f878618239e7cc8afc6d9e255f42081530`. It predates the final account-loading care link and is historical evidence, not the current review candidate. The final incremental build uses `:app:assembleRelease` and `-SkipPrebuild`, rebuilding the changed JavaScript without altering native configuration. See `checks/android-final-review-build.txt`.

During the earlier, pre-pin attempt, merging the parent's Stripe test dependency changed the lockfile. Both lanes' subsequent `pnpm` validation calls automatically synchronized it (+2/-1: PGlite and a Drizzle peer relink) despite no explicit install command. Native dependency versions did not change, but that earlier attempt was not an isolated/frozen-dependency build. Validation then switched to direct Node entrypoints. The successful pinned and final incremental builds had no dependency mutation.

The staging setting uses Android's documented [CMake buildStagingDirectory](https://developer.android.com/reference/tools/gradle-api/9.2/com/android/build/api/dsl/Cmake). Both staging and Ninja overrides are opt-in process environment variables; dependency sources, package manifests, the Windows registry and security controls are unchanged by this workaround.

Obtain `ninja-win.zip` from the release link above, verify its SHA-256, and extract it to a short private tools directory. Do not replace the shared SDK copy. Run only one native build at a time, in a fresh PowerShell process:

```powershell
Set-Location -LiteralPath 'C:\Users\James\Documents\GitHub\SecondBreakfast\apps\mobile'
./scripts/build-android-review.ps1 -Configuration account-preview -JavaHome 'C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot' -AndroidHome 'C:\Users\James\AppData\Local\Android\Sdk' -NinjaExecutable 'C:\Users\James\.sb-native\tools\ninja-1.13.2\ninja.exe'
```

The script runs the installed Expo CLI directly through Node, with Android prebuild and no dependency installation before Gradle. It does not invoke pnpm, which can implicitly synchronize a changed lockfile. `-SkipPrebuild` is only for an incremental retry when native configuration/plugins are unchanged. Generated Android files are ignored, not authoritative source. `-NativeStaging` selects another short absolute directory. Never share its contents or source `.env` files as tester artifacts. The opt-in init script limits Metro bundling to two workers.

`account-preview` requires a **test** Clerk publishable key in the process environment or existing mobile `.env`, without printing it. `guest-preview` explicitly disables dotenv/key loading and cannot exercise account features. Both enable the woodland flag and use the configured API origin; the flag does not authorize hosted APIs. The default origin is the existing hosted Second Breakfast site, whose candidate revision and invited accounts must be verified independently before integration testing.

The generated Expo release signing configuration uses the publicly known Android debug keystore. A successful APK from this recipe is a local review artifact, not a cohort-approved signed release. Distribution requires an owner-controlled release key, confirmed backend/Clerk configuration, and the parent's reviewed rollout. Do not uninstall an existing app to bypass a signing mismatch: preserve its data and coordinate an explicit migration first.

## Android interaction and physical devices

The configured emulator cannot start with acceleration because its hypervisor driver is missing. A prior software fallback did not expose an adb device. No driver was installed, no security setting was weakened, and no emulator interaction is claimed. No physical device was available or tested.

After a reviewed APK is available, run `adb devices -l`, confirm the intended disposable device, then install with `adb -s SERIAL install -r PATH_TO_REVIEW_APK`. This review build is arm64-v8a, not x86_64. Do not run account/shopping tests on a personal production account. Use invited disposable development fixtures and the matching test backend.

Required device checks remain: cold and repeat offline care launch; guest care from a link and the sign-in surface; optional restrictions, empty pantry, unavailable settings; sign-in preserving selection; expired session and failed/ambiguous list writes; logout/account switching; both themes; large system font; TalkBack labels/order; keyboard focus; reduced decoration and reduced-motion transitions. Cross-app installation, absence, failure, onboarding and return steps are in `handoff-evidence.md`.

## Artifact status

**Final review APK built successfully**, including the last account-loading care link. The incremental build completed in 1m56s with 608 tasks (24 executed, 584 up to date). `checks/android-final-review-build.txt` records the successful build. No build or dependency process remains owned by this lane.

| Property | Verified value |
| --- | --- |
| Artifact | `apps/mobile/.expo-export/account-preview/second-breakfast-arm64-review.apk` |
| Size | 51,258,957 bytes |
| SHA-256 | `b828dcf86cbba709d0fc1905a38e5cf1495cb8acd789e4c2357aae0fe4d82957` |
| Package/version | `com.secondbreakfast.app`, `0.1.0`, version code 1 |
| ABI/SDK | `arm64-v8a`; min SDK 24, target/compile SDK 36 |
| Signature | APK v2 verifies; `CN=Android Debug`, RSA 2048 |
| Certificate SHA-256 | `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` |
| Configuration | Release mode; `account-preview`; woodland enabled; test Clerk publishable key; existing hosted API origin |
| Distribution | Local review only; no approved cohort release key or rollout |
| Runtime evidence | No emulator, physical device, account session, or live shopping test |

`apksigner verify --verbose --print-certs` and `aapt dump badging` passed; see `checks/android-apk-signing.txt` and `android-apk-badging.txt`. The packaged `assets/index.android.bundle` is 4,229,132 bytes, SHA-256 `224bc085b55b92187e0a5eb641153407d939fc038cac810eba3236b40d5f4bbd`. Byte inspection confirmed the final loading-screen care message/link, pantry limitation, account-pinned token error and bounded-write message are present. Test-key and expected-API-origin presence were recorded only as booleans. This verifies packaged source content, not interactive behavior. `checks/android-artifact-manifest.json` records these results without the key.

`checks/android-source-manifest.json` records 107 mobile source/assets/build-script and shared catalogue/dietary/unit hashes after the final care edits. All 107 still matched after packaging. The three dependency hashes in `checks/android-dependency-manifest.json` also matched. `checks/android-source-verification.json` records both zero-drift checks and the manifest hashes. No environment values or credentials are included. A scan of the 15 Android/handoff build and validation logs found no test-key values.

The final mobile TypeScript check and all nine lane helper tests passed. A fresh `adb devices -l` remained empty (`checks/android-adb-devices.txt`). Native ownership has been returned to the parent for integration review; no deployment, device installation or distribution was performed.

## Remaining release blockers

- Review and configure owner-controlled release signing and matching test Clerk/backend settings for cohort distribution. This test-key APK still points to the existing hosted origin, not a verified deployed candidate.
- Complete Android interaction and physical-device checks separately, including guest cold-offline entry, account restoration, failed writes, accessibility and cross-app OS dispatch.
- Adapt and review the Wispling handoff against its active alpha when its owner includes that work. The isolated legacy patch/export does not wire current alpha. See `handoff-evidence.md`.

## Changed-file handoff

The native lane's additions and follow-up edits are in `app/+native-intent.tsx`, `app/_layout.tsx`, `app/(protected)/_layout.tsx`, `modules/account/AuthGate.tsx`, `modules/care/CareScreen.tsx`, `modules/care/nativeLink.ts`, `modules/care/saveIdea.ts`, `lib/accountToken.ts`, `lib/client.ts`, `ui/Button.tsx`, `ui/ThemeProvider.tsx`, `test/care-links.test.mjs`, `test/care-save.test.mjs`, `scripts/build-android-review.ps1` and `scripts/windows-native.init.gradle` under `apps/mobile`. The coordinated exact native pins changed `apps/mobile/package.json` and `pnpm-lock.yaml`. The parent's earlier public-route moves, woodland components/assets and concurrent legal changes remain intact. No unrelated files were committed or reset.
