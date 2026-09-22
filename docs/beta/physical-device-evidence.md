# Android physical-device evidence

The current account-capable ARM64 review build was installed and exercised on a connected Samsung SM-T970 running Android 13. This is physical-device validation for the specific debug-signed artifact below. It is not store-signing, cohort-distribution, iOS, or owner acceptance evidence.

## Artifact

- Path: `apps/mobile/.expo-export/account-preview/savortome-arm64-physical-review.apk`
- Size: 63,003,296 bytes
- SHA-256: `9920afc086271d575b7c0618f1531fb7e3fbde7487af24d24c4cacb9907b47c3`
- Package: `com.skaldandstone.savortome`, version `0.1.0` (`1`)
- SDK: minimum 24, target 36
- ABI: ARM64 only
- Signature: APK Signature Scheme v2, Android Debug certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`
- Backup: `android:allowBackup=false`; backup and data-extraction resources remain declared for platform compatibility.

The first full build reached native compilation and release packaging, then exhausted the review script's 512 MiB Gradle metaspace during release lint. The script now grants Gradle 2 GiB heap and 1 GiB metaspace. The final incremental rebuild used the canonical `https://savortome.skaldandstone.com` API origin and completed 838 tasks successfully in 4 minutes 32 seconds. It was reinstalled over the prior review build before the final cold Care launch and UI-hierarchy check.

## Checks performed

- Installed and cold-started the APK on the physical tablet.
- Opened guest **Feed me gently** from the signed-out screen and through `seconds://care`.
- Confirmed three immediate suggestions appear without account API access.
- Expanded a suggestion and confirmed the exact ingredient, ordered steps, and single-item shopping action are visible.
- Pressed the guest shopping action and confirmed the selected idea remains present while the app says nothing was added and offers a named sign-in return action.
- Disabled Wi-Fi, cold-started the deep link, and confirmed the basic deterministic suggestions still appear. Wi-Fi was restored.
- Tested Android font scale 1.5. Titles, cards, instructions, and allergen disclaimer remained readable and scrollable without clipped text. Font scale was restored to 1.0.
- Enabled reduced decoration and confirmed the control changes to **Show illustrations** while the full Care content remains available.
- Requested landscape at the system level and confirmed the app remains in its declared portrait layout. Rotation settings were restored.
- Opened a malformed Care link with an untrusted return destination. Care still rendered and no untrusted return text or destination appeared.
- Reviewed the captured device log for fatal app exceptions and React Native runtime errors; none appeared.

Samsung TalkBack is installed. Enabling it opened the device's own first-run five-page tutorial before app traversal. The service was disabled and all accessibility settings were restored. The app's native UI hierarchy exposes the Care controls and content, but a completed physical screen-reader traversal remains open until the device tutorial is completed by its owner.

Receipt camera/gallery capture and signed-in pantry writes were not exercised because this device has no Savortome account session. The scan endpoint remains correctly disabled without the explicit metered feature flag and provider key; no paid model call was made.

Screenshots retained for review:

- `checks/physical-device-initial.png`
- `checks/physical-device-care.png`
- `checks/physical-device-care-large-text.png`
- `checks/physical-device-care-reduced.png`
