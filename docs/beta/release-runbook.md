# Private beta release runbook

Status: candidate and rollback images are independently verified; runtime release
is blocked on the reviewed service and HTTPS foundation. These instructions use
development account `734702670689`, profile `skaldandstone-dev`, region
`us-east-2`. Account `574921529762` is historical and must not receive this beta.
Do not use `scripts/deploy-aws.ps1` unchanged: it archives `origin/main`, builds
from a mutable S3 key and force-redeploys without the cohort, source, digest,
privacy rollback or drift checks required here.

`scripts/beta-release.ps1 -Mode VerifyImages` was run against AWS read APIs for
the current candidate and rollback. No task definition, ECS service, load
balancer, DNS record, secret or runtime was created or changed. The selected
account still has no Second Breakfast ECS service or endpoint.

The [image parser review](image-parser-security.md) adds a manual candidate and
rollback source/build requirement: verify `images.unoptimized: true` and empty
`remotePatterns` in the reviewed Next config and built `required-server-files.json`.
The existing privacy-v3 label does not prove this image configuration. Retain both
protections when preparing a bridge/rollback image. The parser itself remains
unpatched; trusted build inputs and future dependency remediation remain required.

## Configuration and build requirements

| Setting | Required behavior |
| --- | --- |
| `SB_BETA_ENABLED` | Server runtime, exact `true` enables checking the cohort. Unset/false keeps the previous experience |
| `SB_BETA_CLERK_USER_IDS` | Server runtime, comma-separated exact Clerk user IDs. Empty denies hosted care |
| `SB_BETA_LOCAL_PREVIEW` | Local development only; release script forces false. Cannot grant production access |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Must be present in the image at build time for hosted sign-in. Runtime injection alone cannot repair a missing inlined key |
| `CLERK_SECRET_KEY` | Runtime secret reference from the existing configuration; never Docker build context/ARG or committed packet text |
| `NEXT_PUBLIC_ENABLE_SW` | Docker build ARG, default false. Reviewed beta image explicitly true; independent of server authorization |
| `SB_RELEASE_COMMIT` | Full reviewed Git commit supplied as Docker build ARG and OCI revision label. Runtime value alone is not source proof |
| OCI `com.secondbreakfast.public-cache-version` | Fixed `3` in the reviewed Dockerfile; verifier requires it for candidate and prior image |
| `NODE_EXTRA_CA_CERTS` | Preserve `/etc/ssl/rds-global-bundle.pem` and the trusted bundle in the container. Remote PostgreSQL requires certificate verification |
| `STRIPE_CHECKOUT_ENABLED`, `STRIPE_LIVEMODE` | Both false for the free beta; retain unavailable live grocery integrations as unavailable |

Never set `NODE_TLS_REJECT_UNAUTHORIZED=0` or accept a PostgreSQL URL override that disables certificate checks. Existing local TLS-driver tests are not a live RDS certificate validation. Preserve current task roles, secret references and networking. The Docker context excludes local env files, dependencies, native/generated builds and review art; production raster assets remain included. Do not place credentials in an image report.

## Prepare the reviewed source and evidence

1. Seal the reviewed workspace with `scripts/build-beta-source-snapshot.ps1`.
   The script uses a temporary Git index, rejects unsafe input, and records the
   archive, embedded manifest, snapshot commit and source tree without changing
   the real index.
2. Authenticate to `skaldandstone-dev` and stop unless STS reports account
   `734702670689` in `us-east-2`. Verify versioned S3 source, CodeBuild identity,
   immutable ECR digest, OCI config and scan results. Do not infer a revision
   from HTTP 200 or an image tag.
3. Before `Prepare`, confirm the reviewed ECS service exists and is stable.
   Record desired count, network configuration, roles, logging and its actual
   running digest. The release script refuses a missing, sleeping or unstable
   service.
4. Bootstrap the service with the reviewed rollback digest and beta disabled.
   The approved rollback is privacy-v3 image
   `sha256:79d7d53cbf332b288d075e9981edf09a49837a1db06f5276842506e4423a55e7`.
   Never use the pre-beta broad-cache image.

PowerShell, canonical repository:

```powershell
Set-Location -LiteralPath 'C:\Users\James\Documents\GitHub\SecondBreakfast'
aws sts get-caller-identity --profile skaldandstone-dev --region us-east-2
./scripts/beta-release.ps1 -Mode Inspect
```

`Inspect` is read-only and reports configured task/image references; separately
inspect `list-tasks` and `describe-tasks` for actual running digests. It currently
fails closed because the expected service does not exist. Keep secret values and
tester identities out of committed evidence.

## Image verification paths

Always record an immutable
`734702670689.dkr.ecr.us-east-2.amazonaws.com/skaldandstone-development-foundation/secondbreakfast-web@sha256:...`
reference. A tag, runtime commit variable or unattested JSON file is
insufficient.

**Local Docker inspection.** Separately pull the reviewed digest using the existing ECR login, then let Prepare inspect it. The script does not pull/build images. It checks RepoDigests, OCI commit, privacy version, SW build flag and a build-time Clerk key. This is local inspected metadata, not an independent source attestation; the owner must review the build source and build record. Do not dump full image environment to shared logs.

**Current artifact-free CodeBuild and ECR path.** No local Docker is needed. The
verifier accepts only:

- Project `skaldandstone-development-foundation-secondbreakfast-web` in the
  expected account and region, exact build ID and successful result.
- The SHA256 of the exact reviewed inline buildspec string from `build.source.buildspec`. Passing only a filename as the buildspec is unsupported by this verification path.
- S3 source under `skald-dev-734702670689-artifacts/sources/secondbreakfast/`
  with a pinned VersionId and checksum matching the reviewed archive.
- The exact ECR manifest and a locally downloaded config blob whose SHA-256
  equals the manifest config digest. The config must prove linux/amd64, UID
  65532, direct distroless Node, exact source and revision labels, privacy-v3,
  service worker enabled, and no media-helper paths.
- ECR BASIC scan status `COMPLETE` with zero findings. Amazon Inspector ECR is
  disabled, so this is not enhanced or full-coverage scanning.

The foundation project deliberately uses `NO_ARTIFACTS`. Download the config
blob named by the ECR manifest with `ecr get-download-url-for-layer`, retain it
outside Git, and pass its expected digest to the verifier. The downloaded file
is not trusted on its own: its SHA-256 must equal the config digest in the live
immutable ECR manifest. Preserve the source VersionId, archive checksum,
embedded manifest hash, buildspec hash and image config digest together.

The direct ECR path has passed against both live immutable images. Evidence is
stored outside Git under
`C:\Users\James\Documents\Codex\2026-08-31\i-n\outputs\secondbreakfast-release\image-verification`.

## Cohort enrollment and removal

Collect each consenting tester's exact Clerk ID from the correct existing Clerk instance privately. Do not use email text, display names, a browser-supplied ID, or another Clerk instance's ID. No invitation is sent by the release script. Review the complete cohort list, including removals, before applying it.

Use a new local release directory per change. In PowerShell, set `$reviewedCommit`, `$rollbackCommit`, `$imageDigest`, `$cohort` and `$packet` to the reviewed real values. `$cohort` is an array such as `@('user_EXAMPLE1','user_EXAMPLE2')`; examples are not enrolled identities. Store real packets outside Git with restricted local access because task environment entries and cohort IDs may be sensitive.

Local Docker path:

```powershell
./scripts/beta-release.ps1 -Mode Prepare -Image $imageDigest -ReviewedCommit $reviewedCommit -RollbackReviewedCommit $rollbackCommit -ClerkUserIds $cohort -ReleaseDirectory $packet
```

Current CodeBuild/ECR path adds these verified inputs:

```powershell
./scripts/beta-release.ps1 -Mode Prepare -Image $imageDigest -ReviewedCommit $reviewedCommit -RollbackReviewedCommit $rollbackCommit -ClerkUserIds $cohort -CodeBuildId $buildId -ImageConfigJson $imageConfig -ExpectedConfigDigest $configDigest -ReviewedSourceSha256 $archiveSha -ReviewedManifestSha256 $manifestSha -ReviewedBuildspecSha256 $buildspecSha -RollbackVerificationConfig $rollbackConfig -ReleaseDirectory $packet
```

`RollbackVerificationConfig` is a local JSON file with `image`, `codeBuildId`,
`imageConfigJson`, `expectedConfigDigest`, `reviewedSourceSha256`,
`reviewedManifestSha256` and `reviewedBuildspecSha256` for the prior image. It is
input to fresh AWS verification, not trusted proof by itself. `VerifyImages`
checks candidate and rollback without requiring an ECS service. `Prepare`
repeats those checks and also requires the running service digest to equal the
reviewed rollback.

To remove a tester, prepare a new packet with the remaining full cohort, using the currently reviewed hardened image. To remove everyone, use the kill switch. Confirm next-request denial with the removed account after rollout; already rendered screens and local generic ideas are not remotely erased. Explain this to testers. Do not delete their account or recipe data as part of removal.

## Review, rollout and observation

Prepare performs AWS reads and local writes only. Review `candidate-task.json`, `rollback-task.json`, and `release.json` together. Confirm all image digests, full commits, both privacy-policy proofs, exact cohort and default-false local preview. Compare preserved environment/secret references, IAM roles, CPU/memory, ports, volumes, architecture and tags with the live definition. The packet directory lock prevents overlapping operators; file hashes and service fingerprints catch subsequent edits/drift. It is not a cryptographic signature against someone who can rewrite the whole local packet.

The release owner may deploy only after the remaining gates are signed off:

```powershell
./scripts/beta-release.ps1 -Mode Deploy -ReleaseDirectory $packet
aws ecs wait services-stable --cluster skaldandstone-development-foundation-cluster --services skaldandstone-development-foundation-secondbreakfast-web --profile skaldandstone-dev --region us-east-2
```

Deploy rechecks stable state and task/config drift, registers the pinned rollback before candidate, preserves capacity/network/schedule, and enables the ECS circuit breaker with rollback. It saves registrations before the update request; an uncertain update is not silently retried. Inspect the saved ARNs and live state before any manual recovery. Successful command return means requested, not validated.

After stability, independently compare all running task image digests to the reviewed candidate. Exercise invited/non-invited/signed-out care, prior non-invited layout, profile/pantry/list ownership, failed writes, sign-out/account switching, worker update and online `/care-offline.html` denial. Check logs without collecting health/profile contents. Retain exact UTC observation time, commit/digest, task ARN and reviewer. Release no invitations or downloads until these pass.

## Kill switch and rollback

The normal fallback is disabling beta on the current hardened image, which preserves the cache privacy fix. Prepare a fresh directory; no replacement image is accepted:

```powershell
./scripts/beta-release.ps1 -Mode Prepare -DisableBeta -ReleaseDirectory $killPacket
./scripts/beta-release.ps1 -Mode Deploy -ReleaseDirectory $killPacket
```

This is a rolling configuration change, not an instant global logout. Verify completed deployment and next-request denial. During service sleep preserve the schedule; do not claim immediate action. If the old service is unhealthy, the normal stable-state guard can block preparation; inspect with the release owner instead of bypassing it.

Full rollback is exceptional and requires the saved reviewed privacy-hardened prior image evidence:

```powershell
./scripts/beta-release.ps1 -Mode Rollback -ReleaseDirectory $packet
```

The script refuses an unrelated newer release, a changed packet or missing privacy proof. It does not promise database migration reversal. Review schema compatibility separately, especially any integrated billing migration. Do not roll back to the pre-beta broad-cache image. Kill-switch packets without prior build evidence cannot be used for full rollback.

## Cost and data boundaries

Reuse the existing ECS/ECR/CodeBuild/S3/Clerk setup and scale-down arrangement. No new fixed monthly service was provisioned. A build, retained image/report/archive, rollout overlap and asset transfer can have incremental costs on the existing services; current usage/rates and budget headroom are unverified, so there is no claimed zero-dollar release. Keep artifacts small and retention deliberate without deleting the pinned rollback. Do not change running hours, desired count or compute size to make tests pass. Paid AI, real charges, grocery checkout and public launch remain off.
