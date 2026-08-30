# Private beta release runbook

Status: local safeguards tested, live release blocked. These instructions are for the release owner after review. No commands below were run against AWS by this lane. Do not use `scripts/deploy-aws.ps1` unchanged for the beta: it archives `origin/main`, builds from a mutable S3 key and force-redeploys. It does not provide this packet's cohort, source/digest, privacy rollback or drift checks.

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

1. Finish integration, inspect `git status`, review the diff, commit only intended work, and record the full commit. Rebuild from that committed source. Run final acceptance checks and retain outputs, build configuration, APK signing identity and hashes. The uncommitted shared checkout is not a releasable source revision.
2. Authenticate to the existing AWS profile and inspect identity first. Stop unless account is `574921529762` and region is `us-east-2`. Read the deployed task definition, all running task digests, existing CodeBuild project/source/buildspec, and the actual scale-down schedule. Do not infer a deployed revision from HTTP 200 or `:latest`.
3. Confirm the service is in its existing running window and stable. The script refuses desired count zero; do not wake it or alter the schedule just to bypass that guard. Record existing desired count, capacity, deployment/network config, role ARNs and logging settings privately.
4. Verify the current previous image is privacy-hardened. Both manual and automatic rollback must retain the public-only worker. If current source is the pre-beta broad-cache image, stop beta rollout. Have integration separately review a privacy-only bridge release, with beta disabled, before preparing this beta packet. No bridge revision or live rollback suitability is established yet.

PowerShell, canonical repository:

```powershell
Set-Location -LiteralPath 'C:\Users\James\Documents\GitHub\SecondBreakfast'
aws sts get-caller-identity --profile secondbreakfast-toolkit --region us-east-2
./scripts/beta-release.ps1 -Mode Inspect
```

`Inspect` is read-only and reports configured task/image references; separately inspect `list-tasks`/`describe-tasks` for actual running digests. Keep secret values and tester identities out of committed evidence. No new service, cluster, bucket, schedule, account or subscription is needed.

## Image verification paths

Use one of the following paths for each candidate and rollback image. Always record an immutable `574921529762.dkr.ecr.us-east-2.amazonaws.com/secondbreakfast-web@sha256:...` reference. A tag, runtime commit variable or unattested JSON file is insufficient.

**Local Docker inspection.** Separately pull the reviewed digest using the existing ECR login, then let Prepare inspect it. The script does not pull/build images. It checks RepoDigests, OCI commit, privacy version, SW build flag and a build-time Clerk key. This is local inspected metadata, not an independent source attestation; the owner must review the build source and build record. Do not dump full image environment to shared logs.

**Existing CodeBuild artifact.** No local Docker is needed, including for rollback. The verifier reads the expected successful build through AWS and accepts only:

- Project `secondbreakfast-web-build` in the expected account/region, exact build ID and successful result.
- The SHA256 of the exact reviewed inline buildspec string from `build.source.buildspec`. Passing only a filename as the buildspec is unsupported by this verification path.
- Git source with `resolvedSourceVersion` equal to the reviewed commit, or the existing S3 source bucket with a pinned, non-null object version and SHA256 matching the reviewed commit archive. For S3, the verifier uses version-specific `head-object --checksum-mode ENABLED --expected-bucket-owner`; missing versioning/checksum is a blocker, not permission to weaken verification.
- A downloaded ZIP of at most 1 MB matching `build.artifacts.sha256sum`. The ZIP must contain exactly one bounded `beta-image-report.json`. The report must match build ID/source version, immutable image, OCI commit, privacy version and actual SW/Clerk build metadata.

AWS exposes artifact SHA256 for ZIP packaging: [BuildArtifacts reference](https://docs.aws.amazon.com/codebuild/latest/APIReference/API_BuildArtifacts.html). S3 source versions and Git resolved commits are distinct: [CodeBuild environment variables](https://docs.aws.amazon.com/codebuild/latest/userguide/build-env-ref-env-vars.html). Preserve the returned artifact checksum, source version and reviewed buildspec in the packet. Existing bucket versioning, artifact permissions and checksum availability have not been checked live.

Prepare the S3 source as an exact `git archive --format=zip` of the reviewed full commit, not a ZIP of the dirty checkout. Compute its SHA256, record its association with that commit, upload with SHA256 checksum through the existing reviewed pipeline, and pin the returned VersionId in StartBuild. Verify the exact buildspec before starting; no cloud build was started here. Download the output ZIP from the build's returned artifact location through the authenticated AWS CLI.

The reviewed buildspec must pass the Clerk public key, `NEXT_PUBLIC_ENABLE_SW=true` and the full commit to `Dockerfile.web`. After a successful Docker build/push, resolve and pull the exact digest within that existing build, then run:

```sh
test "$CODEBUILD_BUILD_SUCCEEDING" = 1
node scripts/write-beta-image-report.mjs "$REVIEWED_IMAGE_DIGEST_REFERENCE"
```

`SB_RELEASE_COMMIT` must remain set in that build environment. The writer inspects the image itself and outputs `beta-artifacts/beta-image-report.json` without key values. Configure the existing job's reviewed artifact override for ZIP packaging, base directory `beta-artifacts`, file `beta-image-report.json`, using existing private S3 storage. Do not create infrastructure or widen IAM as an incidental step. Review any needed existing-project change separately. CodeBuild's post-build phase can run after a failed build; both the writer and release verifier reject failure.

Both paths and the report writer are mocked locally. There is no live candidate digest, successful reviewed CodeBuild ID, archive checksum or artifact ZIP to fill in yet.

## Cohort enrollment and removal

Collect each consenting tester's exact Clerk ID from the correct existing Clerk instance privately. Do not use email text, display names, a browser-supplied ID, or another Clerk instance's ID. No invitation is sent by the release script. Review the complete cohort list, including removals, before applying it.

Use a new local release directory per change. In PowerShell, set `$reviewedCommit`, `$rollbackCommit`, `$imageDigest`, `$cohort` and `$packet` to the reviewed real values. `$cohort` is an array such as `@('user_EXAMPLE1','user_EXAMPLE2')`; examples are not enrolled identities. Store real packets outside Git with restricted local access because task environment entries and cohort IDs may be sensitive.

Local Docker path:

```powershell
./scripts/beta-release.ps1 -Mode Prepare -Image $imageDigest -ReviewedCommit $reviewedCommit -RollbackReviewedCommit $rollbackCommit -ClerkUserIds $cohort -ReleaseDirectory $packet
```

Remote candidate path adds these verified inputs:

```powershell
./scripts/beta-release.ps1 -Mode Prepare -Image $imageDigest -ReviewedCommit $reviewedCommit -RollbackReviewedCommit $rollbackCommit -ClerkUserIds $cohort -CodeBuildId $buildId -BuildArtifactZip $artifactZip -ReviewedSourceSha256 $sourceSha -ReviewedBuildspecSha256 $buildspecSha -RollbackVerificationConfig $rollbackConfig -ReleaseDirectory $packet
```

For Git-backed CodeBuild, omit ReviewedSourceSha256. `RollbackVerificationConfig` is a local JSON file with `codeBuildId`, `buildArtifactZip`, `reviewedSourceSha256` (S3 only) and `reviewedBuildspecSha256` for the prior image; it is input to fresh AWS verification, not trusted proof by itself. Omit it if using local Docker for rollback.

To remove a tester, prepare a new packet with the remaining full cohort, using the currently reviewed hardened image. To remove everyone, use the kill switch. Confirm next-request denial with the removed account after rollout; already rendered screens and local generic ideas are not remotely erased. Explain this to testers. Do not delete their account or recipe data as part of removal.

## Review, rollout and observation

Prepare performs AWS reads and local writes only. Review `candidate-task.json`, `rollback-task.json`, and `release.json` together. Confirm all image digests, full commits, both privacy-policy proofs, exact cohort and default-false local preview. Compare preserved environment/secret references, IAM roles, CPU/memory, ports, volumes, architecture and tags with the live definition. The packet directory lock prevents overlapping operators; file hashes and service fingerprints catch subsequent edits/drift. It is not a cryptographic signature against someone who can rewrite the whole local packet.

The release owner may deploy only after the remaining gates are signed off:

```powershell
./scripts/beta-release.ps1 -Mode Deploy -ReleaseDirectory $packet
aws ecs wait services-stable --cluster secondbreakfast-cluster --services secondbreakfast-web --profile secondbreakfast-toolkit --region us-east-2
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
