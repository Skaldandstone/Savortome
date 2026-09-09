# EAS mobile beta build evidence

Date: 2026-09-08 (America/Los_Angeles)

## Configuration

Savortome is linked to Expo project `@skald-and-stone/seconds` (`88e6ce04-9624-4c8e-8004-1c8147cf4265`). Both platforms use application identifier `com.secondbreakfast.app` and app version `0.1.0`.

`apps/mobile/eas.json` defines two internal-distribution profiles:

- `beta`: Android APK and physical-device iOS build.
- `beta-simulator`: iOS Simulator build.

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

## Android EAS result

EAS accepted the reviewed 84.0 MB archive and generated/stored a remote Android keystore for this project, but it did not schedule a build because the account's free Android build quota is exhausted until 2026-10-01. There is therefore no Android EAS build ID or EAS APK artifact.

Completing the Android EAS build requires either waiting for the quota reset or an owner-approved Expo Starter subscription. No subscription or paid build was purchased. Existing local Android APKs remain separate evidence and must not be described as EAS builds.

## Physical iOS result

The `beta` physical-device build was not submitted. Apple team `BVB696HTCS` is visible to EAS, but that team currently has no registered devices, so EAS cannot create the Ad Hoc provisioning profile required for internal distribution.

Completing this path requires registering at least one intended test device with EAS and then creating the provisioning profile interactively. A later TestFlight path instead requires App Store Connect setup and explicit submission authorization. Neither path was taken here.

## Validation performed

- `npx expo-doctor`: 21/21 checks passed.
- `pnpm --filter @seconds/mobile typecheck`: passed.
- `pnpm -r typecheck`: all four workspaces passed.
- Focused mobile care/helper tests: 9/9 passed.
- Full core tests: 639/639 passed.
- Android production JS export: passed, 34 files / 15,050,561 bytes.
- iOS production JS export: passed, 30 files / 13,773,032 bytes.
- `git diff --check`: passed with only the repository's expected CRLF conversion warnings.

No store submission, public distribution, physical-device test, Android EAS artifact, or physical iOS artifact is claimed.
