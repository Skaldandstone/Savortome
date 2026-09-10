# EAS mobile beta build evidence

Date: 2026-09-08 (America/Los_Angeles)

## Configuration

Savortome is linked to Expo project `@skald-and-stone/seconds` (`88e6ce04-9624-4c8e-8004-1c8147cf4265`). The EAS dashboard display name is `Savortome`; the compatibility slug remains `seconds` so the existing project ID and build history stay linked. Both platforms use application identifier `com.secondbreakfast.app` and app version `0.1.0`.

`apps/mobile/eas.json` defines two internal-distribution profiles and one store profile:

- `beta`: Android APK and physical-device iOS build.
- `beta-simulator`: iOS Simulator build.
- `testflight`: iOS App Store distribution for private TestFlight review.

The EAS `preview` environment contains a sensitive Clerk test publishable key and the non-secret hosted API and woodland-beta settings. No secret value is recorded here. The inspected EAS archive contained no `.env` file or `node_modules` directory and did contain the complete monorepo packages needed by the mobile workspace.

The Expo SDK 57 patch set was updated to the versions accepted by `expo-doctor`. `expo-constants` and `expo-notifications` remain intentionally pinned at `57.0.14` because of the existing supply-chain review boundary; Expo install validation excludes only those two known pins. The workspace's `minimumReleaseAgeExclude` list makes nine exact Expo patch releases reproducible before the normal one-day age window. Remove those exact exceptions after the age window and a clean frozen install have been verified.

## Successful iOS Simulator build

- EAS build: `02f55da1-20c1-4a3e-977e-60f3644a9aa7`
- Status: `FINISHED`
- Profile: `beta-simulator`
- Completed: `2026-09-09T04:00:58.342Z`
- EAS fingerprint: `078c182928a49721ca8d680b64aa394dc1e108fc`
- EAS artifact: `https://expo.dev/artifacts/eas/ZqrrvFiTt7ebwNSoytjToBwPN8Z1Z9SwgfHPxm3rIXM.tar.gz`
- Local artifact: `C:\Users\James\AppData\Local\Savortome\eas-builds\02f55da1-20c1-4a3e-977e-60f3644a9aa7\savortome-ios-simulator-0.1.0-1.tar.gz`
- Size: `49,567,160` bytes
- SHA-256: `1ff091355d8a899bbf3b8f109c7c0ca210e08a71dfcc2560b84dbed3b8b83844`
- Archive validation: 239 entries, no absolute/traversal/backslash paths, and no duplicate paths.

The extracted app reports:

- Display/name: `Savortome`
- Bundle ID: `com.secondbreakfast.app`
- Version/build: `0.1.0` / `1`
- Minimum OS: iOS 17.0
- Platform: `iPhoneSimulator`
- `ITSAppUsesNonExemptEncryption`: `false`
- `main.jsbundle`: 4,942,580 bytes, SHA-256 `0902864ecf602bdf4b7fecedbb69b7eb9b469481f479575fe57de6b5da52be44`

The compiled bundle contains the hosted beta API URL, Clerk test-key marker, and Feed me gently copy. It also contains an inactive `localhost:3000` development fallback from `app.json`/`lib/api.ts`; the build-time hosted URL is present and takes precedence. This residual string is a configuration-hardening follow-up, not evidence that the build contacts localhost.

This artifact is suitable only for an iOS Simulator. It is not an iPhone build, TestFlight build, App Store submission, device validation, or owner visual acceptance. Expo-hosted artifacts expire; the locally hashed copy is the durable review evidence.

## Successful Android EAS build

The initial submission attempt reached the account's free Android quota gate and did not create a build. After the Expo account was upgraded, the same committed configuration was submitted once and completed successfully.

- EAS build: `9a9588da-17e5-48d6-b763-2b03b07b6d9a`
- Status: `FINISHED`
- Profile/distribution: `beta` / internal APK
- Completed: `2026-09-09T05:13:51.941Z`
- Git commit: `447b51e101799a4836eac0da913905600ec8fef8`
- EAS fingerprint: `1f61c36f6eb49e0bc070bb421010391f759e58d7`
- EAS artifact: `https://expo.dev/artifacts/eas/j1jSouIfSkHkw_F2tl0wtANzurccnIqNmxjF31xZD7g.apk`
- Local artifact: `C:\Users\James\AppData\Local\Savortome\eas-builds\9a9588da-17e5-48d6-b763-2b03b07b6d9a\savortome-android-0.1.0-1.apk`
- Size: `115,941,989` bytes
- SHA-256: `d21dcdd754b76019e87d9d349d379e0911751d7e51eb9fe2388b70d98ac4e729`

Package inspection reports:

- Package: `com.secondbreakfast.app`
- App/version: `Savortome` / `0.1.0` (`versionCode 1`)
- Minimum/target SDK: 24 / 36
- Native architectures: `arm64-v8a`, `armeabi-v7a`, `x86`, and `x86_64`
- `android:allowBackup=false`
- APK Signature Scheme v2 signature and content digest both verified.
- Signing certificate SHA-256: `93305b6b387c7f5c1ce0f5e1626fcfd5136c7de0bae5514c510cbf684325647c`
- The EAS-managed signing certificate is not the Android debug certificate.
- Packaged Hermes bundle: 4,275,244 bytes, SHA-256 `33442b65fb4c979f13e57b89adc9589b6bfe71386f27e19b91f3757cc56607a1`

The packaged Android bundle contains the hosted beta API URL, Clerk test-key marker, and Feed me gently copy. It does not contain the `localhost:3000` fallback. The manifest requests network, notification, biometric, wake-lock, boot, install-referrer, and launcher-badge permissions contributed by the configured app and notification dependencies. No blocked external-storage or overlay permission was present.

This is an internally distributed APK signed with the EAS-managed project keystore. It is not a Play Store submission, production release, physical-device validation, or owner visual acceptance.

## TestFlight build and submission

- EAS build: `df058551-dae7-473c-9064-12a3e8f29f27`
- Status: `FINISHED`
- Profile/distribution: `testflight` / App Store
- Completed: `2026-09-09T07:51:31.017Z`
- Git commit: `37ccd7032c19f2421e4e5f27dd35aa7a820d5425`
- EAS fingerprint: `47d6718ee043e769508fb2c28f14f1509e35d9e9`
- App/version: `Savortome` / `0.1.0` (build `1`)
- Bundle ID: `com.secondbreakfast.app`
- EAS submission: `4bc81c24-fc51-492a-bbde-ccd332fbd7be`
- App Store Connect app: `6810124754`

App Store Connect accepted and processed the binary as valid. The private external group `Savortome Private Beta` contains the three owner-supplied tester addresses and build 1 is attached. Tester identities remain out of Git. Apple still reports the testers as `NOT_INVITED` / `NO_BUILDS` because the first external build has not passed Beta App Review. The beta description, feedback address, marketing URL and privacy URL are configured. Apple requires a review contact phone number before the remaining contact details and guest-review instructions can be saved; no phone number was invented.

This is a private TestFlight submission, not a public App Store release, physical-device validation, or owner acceptance.

## TestFlight build 2 (2026-09-10)

A second TestFlight build was produced from `main` after the iOS build number was raised to `2`, because App Store Connect already holds `0.1.0 (1)` and rejects a duplicate `CFBundleVersion`. The Android `versionCode` is unchanged.

- Source commit: `5d14418bfcf485f0e5e35fa0759252e9bb57202e` (bumps `ios.buildNumber` only; the preceding `0696867` main build passed all four typechecks, the web production build and 639/639 core tests).
- EAS build: `609425a4-f82b-4cbf-997a-873d81ef58e3`
- Status: `FINISHED`
- Profile/distribution: `testflight` / App Store
- Completed: `2026-09-10T20:04:14.827Z`
- EAS fingerprint: `17c290a45ac2ed21d5c9b90cf24a1e2f22950c32`
- App/version: `Savortome` / `0.1.0` (build `2`)
- Bundle ID: `com.secondbreakfast.app`
- Expo SDK: `57.0.0`
- EAS artifact: `https://expo.dev/artifacts/eas/MXHHi1wo-c3fNbQtLKZOLFDJvVr6upTPOZfdJ9iczXE.ipa` (expires `2026-10-10`)
- Local artifact: `C:UsersJamesAppDataLocalSavortomeeas-builds09425a4-f82b-4cbf-997a-873d81ef58e3savortome-ios-testflight-0.1.0-2.ipa` (sidecar `.sha256` alongside)
- Size: `38,275,582` bytes
- SHA-256: `d4cd67cc77b65e742413815cf3355b7664bb29bbfd3ca612713a8e712cdcc9ef`
- Archive validation: 215 entries, no absolute/traversal/backslash paths, and no duplicate paths. `embedded.mobileprovision` and `_CodeSignature/CodeResources` are present.

The extracted app reports:

- Display/name: `Savortome`
- Bundle ID: `com.secondbreakfast.app`
- Version/build: `0.1.0` / `2`
- Minimum OS: iOS 17.0; device families iPhone and iPad
- Platform: `iPhoneOS`, built with Xcode 26.6 against the iOS 26.5 SDK
- `ITSAppUsesNonExemptEncryption`: `false`
- `main.jsbundle`: 4,942,635 bytes, SHA-256 `850e7a5fcc4beb01969115b31d003245bf3f4dd44e0c8637fd9eb26d6c436189`

The compiled bundle contains the hosted beta API URL, Clerk test-key marker and Feed me gently copy, and still carries the inactive `localhost:3000` development fallback noted for the simulator build. That residual string remains a configuration-hardening follow-up.

Submission used a new `submit.testflight` profile in `apps/mobile/eas.json` carrying the public App Store Connect app ID `6810124754` and Apple team `BVB696HTCS`, because `eas submit --non-interactive` cannot resolve the target app without it. The App Store Connect API key remains on EAS servers (key ID `P6KLFX57HZ`); no credential value is recorded here.

- First submission attempt `c96a9489-0a1f-4c2a-8c24-3eeaaa378ebc` reached `ERRORED` at `2026-09-10T20:07:36Z` with no error text surfaced by the CLI; EAS marked it retryable.
- Retry `aaffbb1c-112a-4235-8e57-fa41a588731d` reached `FINISHED` at `2026-09-10T20:11:53.275Z`; EAS reported the binary uploaded to App Store Connect.

App Store Connect processing, attachment of build 2 to the `Savortome Private Beta` group, tester invitation state and Beta App Review were not inspected in this pass. As with build 1, this is a private TestFlight submission, not a public App Store release, physical-device validation or owner acceptance.

## Physical iOS result

The `beta` physical-device build was not submitted. Apple team `BVB696HTCS` is visible to EAS, but that team currently has no registered devices, so EAS cannot create the Ad Hoc provisioning profile required for internal distribution.

Completing the Ad Hoc path requires registering at least one intended test device with EAS and then creating the provisioning profile interactively. The separate TestFlight path above does not require device registration.

## Validation performed

- `npx expo-doctor`: 21/21 checks passed.
- `pnpm --filter @seconds/mobile typecheck`: passed.
- `pnpm -r typecheck`: all four workspaces passed.
- Focused mobile care/helper tests: 9/9 passed.
- Full core tests: 639/639 passed.
- Android production JS export: passed, 34 files / 15,050,561 bytes.
- iOS production JS export: passed, 30 files / 13,773,032 bytes.
- `git diff --check`: passed with only the repository's expected CRLF conversion warnings.

No public App Store distribution, physical-device test, or owner acceptance is claimed.
