# Savortome official-name migration

Date: 2026-09-22

Savortome is the only official application, store, provider, account, and public product name. “Second Breakfast” may be used only as the name of an in-app mode. Existing technical identifiers are compatibility inputs, not permission to present a second product.

## Verified current identity

- GitHub repository: `Skaldandstone/Savortome`.
- Clerk application: `Savortome`, with development and production instances. New Studio approval metadata uses `studio_access.savortome.approved`. The server temporarily reads `studio_access.second-breakfast.approved` so existing approvals continue to work.
- Apple/iOS source identity: display name `Savortome`, bundle identifier `com.skaldandstone.savortome`. App Store Connect display metadata still requires a provider-side check.
- Google/Android source identity: display name `Savortome`, application ID `com.skaldandstone.savortome`. Play Console display metadata still requires a provider-side check.
- Public web origin: `https://savortome.skaldandstone.com`.
- Recipe exports now identify themselves as `savortome-recipes` and download as `savortome-YYYY-MM-DD.json`.
- New local Android review artifacts default to `savortome-arm64-review.apk`.

## Compatibility identifiers retained deliberately

| Legacy identifier | Current dependency | Retirement gate |
| --- | --- | --- |
| EAS project `@skald-and-stone/seconds`, project ID `88e6ce04-9624-4c8e-8004-1c8147cf4265` | Existing updates, credentials, builds, TestFlight and Play submission history | Rename the existing EAS project in place, then prove the project ID, channels, credentials, build profiles and store links are unchanged before changing the local slug. Do not create a replacement project merely for naming. |
| `seconds://` URL scheme | Installed Android/iOS builds and the Wispling handoff contract | Add and ship `savortome://` alongside the old scheme, update and test both handoff directions, then retire `seconds://` only after supported installed builds have aged out. |
| `@seconds/*` workspace package names | Monorepo import graph and generated build output | Rename in one lockfile-reviewed change after all package consumers and build scripts are inventoried. This identifier is not user-facing. |
| `SB_*` environment variables | Deployed task definitions, release scripts and operator configuration | Introduce `SAVORTOME_*` aliases, dual-read through at least one deployed rollback window, then update task definitions and runbooks before removing the old names. |
| `secondbreakfast-web`, `secondbreakfast-*` AWS resources, database/user names and secret paths | Live ECS, ECR, CodeBuild, RDS, Secrets Manager, rollback verification and historical evidence | Build replacement resources only through a reviewed infrastructure migration. Prove backups, restore, task startup, DNS, health checks, IAM, secrets, image provenance and rollback before retiring anything. No resource is renamed or deleted by this source pass. |
| `com.secondbreakfast.public-cache-version` OCI label | Candidate and rollback image admission checks | Teach release tooling to require a new Savortome label while accepting the old label on existing rollback images, publish and scan both images, rehearse rollback, then remove the legacy check. |
| Stripe metadata `app=secondbreakfast`, integration identifier and idempotency prefixes | Existing test catalog, customers, sessions, webhook deduplication and product-scoped entitlement checks | Keep checkout disabled. Add dual-read compatibility, migrate or recreate only test-mode provider objects with `app=savortome`, replay webhook fixtures, and prove old payments cannot unlock another product before emitting only the new value. |
| `second-breakfast-recipes` archive marker | Previously downloaded JSON exports | Keep the marker recognized as a legacy import format. New exports use `savortome-recipes`; do not rewrite a person's old files. |
| `beta.secondbreakfast.skaldandstone.com` certificate SAN and historical host | Existing links, certificates and rollback/runbook evidence | Keep as a redirect or compatibility hostname until traffic, certificate, Clerk redirect and service-worker checks show it is unused. Never present it as the canonical product URL. |

## External provider gates

1. **EAS:** rename the existing project in place from `seconds` to `savortome`; verify the unchanged project ID, owner, update channels, Android credentials, Apple credentials, TestFlight group and Play internal track before committing the local slug change.
2. **Apple:** verify the App Store Connect display name, TestFlight beta app name, review information and tester-facing emails all say Savortome. Preserve bundle ID and signing entitlements.
3. **Google:** verify Play Console app title, internal testing listing and tester opt-in copy say Savortome. Preserve application ID and signing key.
4. **Clerk:** the application already reports `Savortome`. Update Studio to write `studio_access.savortome`; exercise canonical approval, legacy approval, revocation, sign-in and account switching before removing the legacy reader.
5. **AWS and DNS:** inventory every live legacy identifier and its dependents, design additive Savortome replacements, and rehearse candidate plus rollback before any retirement. The current healthy service remains untouched.
6. **Stripe:** keep checkout and livemode disabled until test-mode catalog metadata, webhook identity, customer ownership, portal and product-scoped entitlement checks pass with the new name and legacy compatibility.

Historical evidence may quote old paths, package IDs or resource names when documenting what actually existed. New prose must label those as historical or legacy identifiers rather than using them as the product name.
