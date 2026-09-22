# Wispling handoff evidence

Current status: implemented in Wispling's active app, merged through [Wispling PR #9](https://github.com/Skaldandstone/Wispling/pull/9) on 2026-09-21, and exercised with Savortome on a physical Android device.

## Privacy and navigation contract

Wispling's current Food and water screen offers a separate, user-initiated button for Savortome food ideas. Wispling's own reminder support remains available whether the handoff succeeds or fails.

The outbound app and web links contain only fixed navigation context:

- `source=wispling`
- `intent=eat_now`
- `return_to=wispling://care-return`

Wispling sends no health history, check-in answer, diagnosis, medication, dietary profile, reminder setting, food choice, or eating-completion information. The return link carries no payload and writes no completion state. Wispling accepts only the exact `wispling://care-return` route after onboarding. Query strings, fragments, extra paths, arbitrary return destinations, and pre-onboarding attempts are rejected.

Installed-app detection uses `Linking.canOpenURL` for `seconds://care`. Detection or launch failure falls back to `https://savortome.skaldandstone.com/care` with the same fixed fields. Failure of both destinations leaves Wispling support available and reports no false success.

## Source validation

The merged Wispling implementation passed:

- TypeScript with no errors.
- 28 Jest suites and 317 tests.
- A focused 35-test group covering handoff privacy, installed-app launch, web fallback, unavailable destinations, onboarding, exact return handling, malformed return rejection, and the existing Weather link.
- ARM64 Android release assembly with 853 Gradle tasks completed successfully.

Two Wispling repository release-policy guards remain unrelated baseline failures: the GitHub workflow is no longer manual-only, and the private-alpha audit detects OTA enabled. The Savortome handoff does not alter either policy.

## Physical Android evidence

Device: Samsung SM-T970, Android 13, connected through ADB.

The current app completed normal onboarding, opened Support circle and Food and water, displayed the themed Savortome card and privacy copy, and launched the installed native Savortome app. Savortome displayed Feed me gently with its normal suggestions and returned through Back to Wispling. Wispling resumed at Home. No completion payload was sent.

A crafted `wispling://care-return?completed=true` link was rejected while Wispling stayed on Food and water. After clearing Wispling app data, an exact cold return link still showed onboarding and did not bypass it. Inspected logs contained no fatal React Native or application error for these interactions.

The final source was also bundled into a self-contained ARM64 review build. The protected release output remained unsigned by design; a separate copy was signed only with the Android debug certificate for local installation.

- Local review APK: `C:\Users\James\Documents\GitHub\.worktrees\wispling-savortome-care-handoff\artifacts\savortome-handoff\wispling-savortome-arm64-physical-review.apk`
- Size: 53,602,225 bytes
- SHA-256: `e8f8debe2c330c354c02424908273aded8ce0f5769782007b9b6f24f575bae28`
- Package: `com.skaldandstone.wispling`, version `0.2.1` / code `3`
- Platform: ARM64, minimum SDK 26, target SDK 36
- Signature: debug certificate, APK Signature Schemes v2 and v3
- Certificate SHA-256: `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`
- Bundled Hermes source SHA-256: `af9de2a8cd26168ddec4c3e068520ffd32714e89bfac9c6ca2f46202516d1e45`
- Manifest: `android:allowBackup=false`; `seconds` installed-app query present

After installation and app-data clearing, this bundled candidate cold-started without Metro to Wispling's expected first onboarding screen. It was the resumed Android activity and logs contained no fatal React Native or Android application error.

## Remaining acceptance

The physical pass proves the Android app-to-app handoff, exact return behavior, and cold packaged launch on the named device. It does not prove TalkBack traversal, iOS physical behavior, store signing, TestFlight or Play distribution, absent-app behavior on a separate physical profile, or owner visual acceptance. Helper tests cover absent-app and failed-launch fallback, but those remain mocked rather than physical.

The older 2026-08-30 legacy-shell patch and its `Second Breakfast` naming are superseded. They did not reach Wispling's active app and should not be applied.
