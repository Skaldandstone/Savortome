# Invited tester guide

This guide becomes usable after the release owner supplies a reviewed URL/build and confirms enrollment. A repository build or screenshot is not an invitation. The beta has no meal scores, reminders, completion tracking or medical advice.

## Web access

The expected existing host is [Second Breakfast](https://secondbreakfast.skaldandstone.com/care), but its beta revision and cohort rollout have not been verified. Wait for the release owner's explicit ready notice. Sign in using the account enrolled in the correct Clerk instance. A non-invited account retains the current app and cannot open hosted care. Do not send passwords, session links or verification codes in feedback.

Opening care from Wispling transfers only optional source, intent, effort, time, temperature, texture and the fixed return destination. It does not send your health history, diagnosis, medication, dietary profile, chosen food or eating-completion information. Back to Wispling is navigation only. It cannot skip Wispling onboarding.

## Android installation

31 August local review artifacts are listed with exact hashes in
[overnight-integration.md](overnight-integration.md): an illustrated account
preview and a separate guest preview. Neither is cohort-approved or installed on
a device yet. The account preview's API origin still names the prior service and
does not establish hosted-candidate integration. The guest preview contains no
configured Clerk test key and can be used for the planned account-free care check
once the owner selects a disposable test device. Both use the same package ID;
do not replace a personal installation or erase its data to switch previews.

Obtain the reviewed APK, SHA256, package/version and signing identity directly from the release owner. No distributable approved APK is promised by this guide. Compare the APK hash with `Get-FileHash -Algorithm SHA256` on Windows before installation. Avoid public uploads or third-party download mirrors.

On an explicitly selected disposable Android test device, either open that APK and permit installation for that source, or use:

```powershell
adb devices -l
adb -s SERIAL install -r PATH_TO_REVIEWED_APK
```

Replace SERIAL and the path with the intended device/build. Stop on a signing mismatch. Do not uninstall an existing personal app or erase its data to work around it. Restore the temporary install-source permission afterward. Local debug-keystore review builds are not cohort-approved releases. A guest-only build cannot test sign-in; the owner must identify which configuration was delivered.

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
