# Final private-beta integration checkpoint

> **Superseding target note, 7 September 2026:** new AWS work belongs only in
> account `051722405355` through `skaldandstone-admin`. Studio requests plus
> James's product-specific approval are the beta admission workflow. See
> [account-admission-migration.md](account-admission-migration.md). Older account
> and static-cohort evidence below remains historical.

Recorded 31 August 2026 after the completed woodland UI and accessibility
continuation.

## Reviewed web source

The current web production source is bound to local build ID
`GRhfwCcQhEsHyFoXqVJvT`. The latest accessibility continuation names secondary
planning, pairing, shelf and timer controls and announces nutrition, billing and
safety-check failures. Its reusable source audit covers all 94 web TSX files.
See [accessibility-continuation.md](accessibility-continuation.md).

Final local checks against the reviewed workspace passed:

- all four workspace TypeScript checks;
- 551 core tests;
- 37 rendered component, authorization, library and image-boundary tests;
- the 94-file native-control accessibility source audit;
- four care state and return-link tests;
- 34 Stripe lifecycle tests with isolated PGlite;
- 61 release-script mock assertions;
- 11 mobile woodland and Android privacy tests;
- the 67-file mobile accessibility source audit;
- the local Kroger stand-in test suite.

The bounded Next 15.5.23 image parser probe still exhausts a disposable 32 MiB
worker for the malformed ICNS and JXL samples. This is residual dependency
risk. The supported local mitigation remains `images.unoptimized: true`, no
remote image patterns, a missing `/_next/image` route, trusted static assets
and immutable build input. It is not a parser fix.

## Immutable private build input

`scripts/build-beta-source-snapshot.ps1` seals the intentional dirty workspace
through a temporary Git index without changing the branch or real index. It
rejects symlinks, credential-like filenames, private or live secret patterns,
files larger than 50 MiB and unreviewed whitespace. Generated evidence, concept
sources and beta patch artifacts are outside the container input.

The reviewed package has:

| Property | Value |
| --- | --- |
| Manifest SHA-256 | `6aeb5d28a68bf33f88ce8904013d38ee570c35b472c9b9c1eaf9b6b1347c2920` |
| Archive SHA-256 | `0d274519adef66872f41bba1c610080c45d618f37e0f9a2966b9cd4527a897d0` |
| Snapshot commit | `4b9c653507bf47975df7f2889845442a14ad8052` |
| Source tree | `45244d3179dd2c320203de73c63cc343f7decf33` |
| Files | 593 source files plus the manifest |
| Size | 35,265,720 bytes |

Local verification found 594 ZIP entries, no bad or duplicate paths, and an
exact embedded manifest hash. The real Git index did not change. Independent
AWS-task verification matched the archive, manifest, snapshot commit, source
tree and 594 entries before building the private candidate described below.
The selected development account is `734702670689`, profile
`skaldandstone-dev`, region `us-east-2`. Account `574921529762` is historical
and must not receive this candidate.

## Android review artifacts

The Android app now sets `allowBackup=false` and removes unused storage and
overlay permissions during Expo prebuild. The review builder accepts a distinct
`x86_64` architecture while keeping `arm64-v8a` as its default.

| Configuration | ABI | SHA-256 | Size |
| --- | --- | --- | --- |
| Guest preview v2 | x86_64 | `d40d8cffe3bcc2e05636ad3a822ab249211c5bf66d85b4197fdc52b9628da380` | 56,753,588 bytes |
| Account preview v2 | x86_64 | `28fec279974735aaa72d40e555748e991910fc5f2d0383d32f29b5c35db035d1` | 56,754,180 bytes |
| Account preview v2 | arm64-v8a | `d63843c2952b31964a88b6bb8bec32ee1437e41e5425fa8e8f3316fa4723d6c8` | 56,309,105 bytes |
| Guest preview v2 | arm64-v8a | `02453c28831de91c5024057b523473863b1d3ecdb08e9fc2fa46c49f6a67336f` | 56,308,513 bytes |
| Final guest reproducibility build | arm64-v8a | `df3f992c619476e680df4f6f88a7abd32db6ad055f4d2da65afa15f0d717f233` | 56,308,513 bytes |
| Accessibility-final guest review | arm64-v8a | `f823846a9a531d6278603e22949559b309c18d7c9c81c507fb1d91f87f8c79cc` | 56,309,405 bytes |

These APKs verify with the local Android Debug certificate and are review-only
artifacts. They are not cohort-signed. The x86_64 emulator could not boot: the
Android Emulator hypervisor is stopped and Windows reports firmware
virtualization disabled. Software acceleration left the device permanently
offline. No emulator interaction, TalkBack result, screenshot or physical
device result is claimed.

The accessibility-final ARM64 guest row is a fresh full-prebuild artifact from
the current native source. Its static audit found zero mismatches across 161
mobile source paths and three dependency inputs, and the packaged Hermes bundle
contains the new durable labels. It does not add runtime or device evidence.

## Wispling active-alpha handoff

The current `wispling-alpha` handoff is implemented in the isolated branch
`codex/alpha-second-breakfast-handoff`. Its 17 test suites and 185 tests,
TypeScript check, release-policy checks and Expo Android prebuild passed. The
canonical active alpha is untouched. The review patch SHA-256 is
`a73928592d45345ded1a42341cd19728bdd2e6642b4aa0aedfb2308255185225`.
Installation and bidirectional OS dispatch remain untested.

## Gates that remain external

The first private container build succeeded but is rejected for release. ECR
basic scanning reported 5 critical, 52 high and 26 medium OS findings, including
the optional FFmpeg stack. `Dockerfile.web` now builds with Node and copies the
application into a nonroot distroless runtime without a shell, package manager,
FFmpeg or yt-dlp. The replacement immutable snapshot and basic scan completed.
The earlier hardened image was independently reverified and is now the reviewed
privacy-v3 rollback candidate.

The final accessibility candidate succeeded as CodeBuild
`skaldandstone-development-foundation-secondbreakfast-web:cc44acc1-edf2-4e04-bca8-2b953208b44e`,
producing immutable digest
`sha256:bfb6f728aac3f545db1616e8ea50e232234bdd6337b0198cdb64fcd302cbb5ff`
and config digest
`sha256:1336c885918997d652f9fa49dc8b6cd6187743a78f351fb0cc65a96168ddb452`.
Its inspected config is linux/amd64, UID 65532, direct Node/Next, exact source
and revision labels, privacy-v3, service worker enabled, RDS CA present, and no
media-helper paths. ECR BASIC scanning completed with zero findings at every
severity. Amazon Inspector enhanced ECR scanning is disabled in the selected
account, so this is not enhanced or full-coverage scan evidence. The saved
CodeBuild project remains placeholder-only, and no Second Breakfast ECS service,
ALB, DNS record or endpoint exists. The image remains undeployed because the
reviewed private runtime foundation does not exist yet.

That image is exact evidence for the current combined source manifest
`6aeb5d28a68bf33f88ce8904013d38ee570c35b472c9b9c1eaf9b6b1347c2920`.
Its versioned S3 object is
`sources/secondbreakfast/private-validation-20260901/6aeb5d28a68bf33f88ce8904013d38ee570c35b472c9b9c1eaf9b6b1347c2920.zip`,
VersionId `xqfxwwEzANUvQ7dItpAQaqbtX_h.HTd.`, and remains marked
`release-approved=false`. Earlier
zero-finding images remain undeployed. Read-only `VerifyImages` checks now prove
that digest
`sha256:79d7d53cbf332b288d075e9981edf09a49837a1db06f5276842506e4423a55e7`
is a distinct privacy-v3 rollback image from snapshot
`28491f46acea729f83403bad7b4b0325a2b6fd4be4f90b34964de5269e6236ab`.
Both candidate and rollback have matching versioned S3 source, CodeBuild,
digest-bound ECR config, source/revision labels and zero-finding BASIC scans.

- Browser visual acceptance, screen-reader use, keyboard interaction and final
  post-fix screenshots remain blocked by the explicit local URL policy.
- Firmware virtualization or a physical Android device is required for runtime
  accessibility and handoff acceptance.
- Private HTTPS, Clerk invited-account flows, account switching and session
  expiry require a deployed private candidate and disposable accounts.
- Real Stripe sandbox Checkout, webhook signature delivery and customer portal
  require the private endpoint and a scoped signing secret. Checkout and live
  mode remain disabled.
- A cohort signing key, named tester identities, invitations, usability review
  and safety review remain owner-controlled release gates.
