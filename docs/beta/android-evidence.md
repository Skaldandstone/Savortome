# Android beta lane evidence

Date: 2026-08-30. Work is in canonical `SecondBreakfast`, branch `codex/whimsical-private-beta`. This report separates source checks, packaged artifacts, runtime testing, and distribution approval.

## Implemented

- `/care` is outside the protected route group. Account screens and existing application routes retain `AuthGate`; native care can render without an account or network catalogue request.
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
5. The parent approved exclusive manifest/lockfile ownership for those exact pins. `pnpm --filter @seconds/mobile add --save-exact react-native-worklets@0.10.1 react-native-reanimated@4.5.1` completed in33.7s, relinking +52/-66 packages in the peer graph. Installed versions were verified; existing Expo/system-ui and Stripe/PGlite/Drizzle/esbuild changes were preserved. See `checks/android-sdk-pin-install.txt`. A fresh prebuild and one arm64 retry follow in `checks/android-pinned-sdk-build.txt`.

During that attempt, merging the parent's Stripe test dependency changed the lockfile. Both lanes' subsequent `pnpm` validation calls automatically synchronized it (+2/-1: PGlite and a Drizzle peer relink) despite no explicit install command. Native dependency versions did not change, but this was not an isolated/frozen-dependency build. Later validation uses direct Node entrypoints until the dependency window is coordinated again.

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

The native retry is in progress; this section must be updated with the final APK/export result, hash, and signing inspection before the lane is handed off. No APK success is implied by the checks above.

`checks/android-source-manifest.json` records hashes of mobile source/assets/build scripts and the relevant shared catalogue/dietary/unit modules after the final care edits. `checks/android-dependency-manifest.json` records the lockfile, mobile manifest and Expo native-version manifest hashes for this attempt. Neither file contains environment values or credentials.
