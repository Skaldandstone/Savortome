# Mobile accessibility continuation

Recorded 31 August 2026 after the woodland UI completion. This checkpoint adds
native source safeguards and a fresh guest APK. It does not claim TalkBack,
Switch Access, emulator, physical-device, visual, signing or cohort acceptance.

## Changes

- Every mobile text field now has a durable accessible name instead of relying
  on placeholder text. This includes discovery, friends, import, pantry search,
  pantry entry and new-shelf controls.
- Tappable recipe rows, plan rows, remove controls, pantry examples, source
  timestamps and the import entry expose an explicit role and contextual name.
- Recipe photos and avatars that repeat adjacent text are hidden from assistive
  technology. Source links retain descriptive link names.
- Shared error callouts announce assertively. Routine status and progress copy
  announce politely without making countdown timers speak every second.
- Compact stars, chips, editor row actions, pantry examples, plan controls and
  source timestamps expose at least a 44 by 44 point target.
- Recipe and list sections use native heading roles. The plan sheet marks its
  content as modal for assistive navigation.
- The ingredient editor now says that its canonical value is the ingredient
  name used for pantry matching. It does not imply the ingredient is present.
- `scripts/check-mobile-accessibility-source.mjs` parses mobile TSX and fails on
  unnamed fields, text inputs, switches, progress indicators, actionable text,
  pressables without roles, and images without a name or hidden state. Its own
  fixtures prove the failure cases.

## Local verification

| Check | Result |
| --- | --- |
| Mobile accessibility source audit | 67 TSX files, zero findings |
| Mobile woodland and privacy contracts | 11 passed |
| Mobile TypeScript | Passed |
| Source whitespace | Passed |
| Full Expo prebuild and ARM64 release assembly | Passed in 9m09s, 608 tasks |

The fresh guest review artifact is
`apps/mobile/.expo-export/guest-preview/second-breakfast-arm64-accessibility-final.apk`.

| Property | Verified value |
| --- | --- |
| Size | 56,309,405 bytes |
| SHA-256 | `f823846a9a531d6278603e22949559b309c18d7c9c81c507fb1d91f87f8c79cc` |
| Package | `com.secondbreakfast.app`, version 0.1.0, code 1 |
| ABI and SDK | `arm64-v8a` only; min SDK 24, target SDK 36 |
| Signature | APK v2, Android Debug certificate, local review only |
| Certificate SHA-256 | `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c` |
| Privacy | `allowBackup=false`; storage and overlay permissions absent |
| Guest boundary | Configured local Clerk test key absent from Hermes |
| Packaged content | Six accessibility labels, six care/woodland markers and four woodland assets present |
| Source and dependencies | 161 source paths and three dependency inputs, zero drift |

The combined web and mobile source is sealed as snapshot commit
`4b9c653507bf47975df7f2889845442a14ad8052`, source tree
`45244d3179dd2c320203de73c63cc343f7decf33`, manifest SHA-256
`6aeb5d28a68bf33f88ce8904013d38ee570c35b472c9b9c1eaf9b6b1347c2920`
and archive SHA-256
`0d274519adef66872f41bba1c610080c45d618f37e0f9a2966b9cd4527a897d0`.
The 35,265,720-byte ZIP has 593 source files plus its manifest. Local audit
read all 594 entries and found no CRC/read failures, unsafe paths or duplicate
paths. The embedded manifest, report, counts and temporary-index result match.
Independent AWS verification matched this exact package. CodeBuild
`skaldandstone-development-foundation-secondbreakfast-web:cc44acc1-edf2-4e04-bca8-2b953208b44e`
produced undeployed image
`sha256:bfb6f728aac3f545db1616e8ea50e232234bdd6337b0198cdb64fcd302cbb5ff`
with config digest
`sha256:1336c885918997d652f9fa49dc8b6cd6187743a78f351fb0cc65a96168ddb452`.
The linux/amd64 image runs as UID 65532 with direct distroless Node, service
worker enabled, privacy-cache label 3, exact source and revision labels, and the
RDS CA path. ECR BASIC scanning completed with zero findings. Amazon Inspector
ECR scanning is disabled, so no enhanced or full-coverage scan is claimed. No
Second Breakfast runtime or endpoint was created, and the image remains
private and undeployed.

The build and audit files are under `docs/beta/checks/`, including
`android-arm64-accessibility-final-audit.json`. The packaged source check proves
the intended strings and assets reached the APK. It does not prove focus order,
spoken output, dynamic text layout, touch behavior, installed-app links or
runtime account behavior.

## Remaining acceptance

The configured x86 emulator still cannot boot because host firmware
virtualization is disabled, and no physical Android device is connected.
TalkBack, Switch Access, large system font, both themes, reduced decoration,
offline cold launch, account switching, failed writes and bidirectional
Wispling dispatch remain device checks. This debug-signed APK must not be sent
to the tester cohort as a release build.
