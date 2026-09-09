# Invited tester guide

This guide lists the current private web and internal mobile review builds. Access still depends on the release owner confirming enrollment. A repository build or screenshot is not an invitation. The beta has no meal scores, reminders, completion tracking or medical advice.

## Web access

Use the private [Savortome beta](https://beta.secondbreakfast.skaldandstone.com/care). Sign in using the account enrolled in the beta's Clerk instance. A non-invited account cannot open the hosted beta. Do not send passwords, session links or verification codes in feedback.

Opening care from Wispling transfers only optional source, intent, effort, time, temperature, texture and the fixed return destination. It does not send your health history, diagnosis, medication, dietary profile, chosen food or eating-completion information. Back to Wispling is navigation only. It cannot skip Wispling onboarding.

## Android installation

Download the current [Savortome Android internal build](https://expo.dev/artifacts/eas/j1jSouIfSkHkw_F2tl0wtANzurccnIqNmxjF31xZD7g.apk). It is EAS build `9a9588da-17e5-48d6-b763-2b03b07b6d9a`, package `com.secondbreakfast.app`, version `0.1.0` (`versionCode 1`), and SHA-256 `d21dcdd754b76019e87d9d349d379e0911751d7e51eb9fe2388b70d98ac4e729`. The APK is signed with the EAS-managed project certificate, whose SHA-256 is `93305b6b387c7f5c1ce0f5e1626fcfd5136c7de0bae5514c510cbf684325647c`. The build and artifact inspection record is in [eas-builds.md](eas-builds.md).

Compare the downloaded APK hash with `Get-FileHash -Algorithm SHA256` on Windows before installation. Avoid public uploads or third-party download mirrors. Expo-hosted internal artifacts expire, so ask the release owner for a refreshed link if this one no longer responds.

On an explicitly selected disposable Android test device, either open that APK and permit installation for that source, or use:

```powershell
adb devices -l
adb -s SERIAL install -r PATH_TO_REVIEWED_APK
```

Replace SERIAL and the path with the downloaded APK. Stop on a signing mismatch. Do not uninstall an existing personal app or erase its data to work around it. Restore the temporary install-source permission afterward. This build targets the private hosted beta and includes its Clerk test configuration; it is not a Play Store release or physical-device acceptance evidence.

## iOS installation

The current [Savortome iOS EAS build](https://expo.dev/accounts/skald-and-stone/projects/seconds/builds/02f55da1-20c1-4a3e-977e-60f3644a9aa7) is an iOS Simulator artifact only. Download and extract it on a Mac with Xcode, then drag `Savortome.app` into an open Simulator or use `xcrun simctl install booted PATH_TO_SAVORTOME_APP`. Its archive SHA-256 is `1ff091355d8a899bbf3b8f109c7c0ca210e08a71dfcc2560b84dbed3b8b83844`.

This artifact cannot be installed on an iPhone. Physical internal distribution remains blocked until the intended iPhone is registered with EAS on Apple team `BVB696HTCS` and a new Ad Hoc build is created. No TestFlight or App Store build is currently available.

## Care and offline behavior

Suggestions appear immediately. Preferences are optional, and every result must respect the choices you selected. If nothing matches, the app keeps those restrictions and says so. Pantry matching does not prove quantity, readiness, packaged ingredients or safety. Check preparation steps and labels. Detected allergens are excluded, but matching does not verify that food is safe for you.

Private Android care has basic suggestions without an account or network. On web, visit the reviewed app online first to install its worker; supported repeat visits can show a generic document after a failed network navigation. Browser policies can refuse workers. The offline document has no saved account, profile or pantry and starts with temporary choices. It does not save or send those choices. There is no direct public offline HTML page online.

If saved settings cannot load, read the notice and use temporary choices as needed. Shopping writes need sign-in and connectivity. Sign-in should preserve your selection, but must not save automatically. If a write fails or its result is uncertain, do not assume it saved or repeatedly retry; reconnect and inspect the actual list first.

## Suggested test session

1. Start signed out. Open care directly and from the cooking screen on the private Android build. On hosted web, confirm sign-in/invitation is required.
2. Try preparation/time, cold/warm, texture and appetite choices. Try an impossible combination such as open-only plus warm and confirm there is no unsuitable fallback. Clear choices to recover.
3. Test empty pantry, saved-settings failure, and temporary restrictions. Confirm pantry ranking explains preparation and quantity limits.
4. Choose a shopping item, sign in, and verify the choice survives without an automatic write. Save while connected; inspect the correct account's list. Repeat with expired session/offline/failed request and confirm no false saved message.
5. Sign out and switch between two disposable accounts. Confirm one account's recipes, profile, pantry and list never appear for the other. Inspect browser cache through the release owner's privacy checklist, not by sharing raw private storage.
6. With both reviewed apps installed, open food handoff from Wispling and return. Test a separate disposable profile without Second Breakfast or without Wispling. Standalone support must remain available. Test before Wispling onboarding and confirm return does not bypass it.
7. Repeat after airplane mode on Android; web offline testing should distinguish actual offline mode from a simulated failed request. Inspect both themes, narrow/wide web, large text, keyboard focus, screen-reader labels, reduced decoration and reduced motion.

## Feedback and removal

Use the manual feedback destination supplied by the release owner; none is created or contacted automatically. Include build/commit ID if supplied, device/browser and version, whether this was emulator or physical hardware, steps, expected result, actual result and connection/account state. A safe example is: “Build X, Android Y, guest, airplane mode: two-minute filter showed an item over two minutes.”

Do not include health history, dietary-profile details, medications, private recipes, Clerk IDs, session tokens or eating-completion reports. Crop/redact screenshots. Report suspected cross-account data exposure privately to the release owner and stop that test; do not post the other account's data.

Ask the release owner to remove your account from the cohort when you are done. Removal prevents later hosted beta access after the updated configuration is serving; it does not delete your recipes/account or remotely erase an installed app and its generic offline catalogue. Account/data deletion is a separate request.
