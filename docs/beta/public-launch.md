# Public launch switch and production readiness

Status: 2026-09-10. James directed that the hosted web experience be opened to
everyone and treated as a production launch. This document records the switch
that opens access, what was launched on the existing host, and the owner-only
gates that still separate the current state from a real production posture.

## The public-access switch

`SB_PUBLIC_ACCESS=true` (exact string) makes `canUseBeta()` return true for every
visitor when `SB_BETA_ENABLED=true`. It skips the owner-approval cohort check
(`studio_access.second-breakfast.approved` metadata and the `SB_BETA_CLERK_USER_IDS`
recovery list). It does not weaken any data boundary: every page and route still
resolves the signed-in user at the point it reads data, and signed-out visitors
see the woodland shell with the "Sign in to see the recipes you've saved" notice
and Clerk sign-in/sign-up.

Wiring:

- `packages/core/src/care.ts` `betaAccess()` gains `publicAccess`; tests cover
  exact-string matching and that it is inert unless `SB_BETA_ENABLED=true`.
- `apps/web/lib/beta.ts` reads `SB_PUBLIC_ACCESS` before the Clerk cohort path.
- `infra/secondbreakfast-private-runtime.yaml` adds parameter `PublicAccess`
  (default `'false'`) injected as `SB_PUBLIC_ACCESS` into the candidate and
  rollback task definitions. The guard pins the default to false and the env
  wiring to the parameter.
- `infra/secondbreakfast-private-database.yaml` adds `DeletionProtection`
  (default `'false'`) and `BackupRetentionDays` (default `1`) so the same
  template can hold a durable instance. The guard pins both defaults.

Turning the switch on is a stack parameter change plus a rebuilt image that
contains the new gate code. Turning it off is the same parameter set back to
`false`; the owner-approval cohort resumes immediately on the next request.

## What "production launch" still requires from the owner

These are not blocked on code. Each needs an action only James can take.

1. **Clerk production instance.** The live image is built against a Clerk
   *development* instance (`pk_test_…`), and the CodeBuild buildspec asserts the
   publishable key starts with `pk_test_` when `PUBLIC_KEY_REQUIRED=true`.
   Development instances are not intended for public traffic. A production
   instance needs a Clerk production application bound to the app's domain,
   its DNS records, and live keys placed into the Secrets Manager secret the
   runtime reads (`CLERK_SECRET_KEY`) plus a new build with the live
   publishable key. The buildspec's `pk_test_` assertion must be relaxed to
   `pk_(test|live)_` at that point. No key material may pass through this
   repository or agent output.
2. **Domain.** `savortome.com` and `savortome.app` return no RDAP record, so
   neither is registered. The launch host remains
   `beta.secondbreakfast.skaldandstone.com`, which is proxied through Cloudflare
   and covered by the issued ACM certificate. A Savortome domain is a purchase
   plus certificate, Cloudflare zone, `NEXT_PUBLIC_APP_URL`, and Clerk domain
   changes.
3. **Billing.** Stripe checkout and live mode stay `false`; the guard enforces
   it. A free public launch needs nothing here. Paid plans are a separate
   decision.
4. **Clerk sign-up restrictions.** Public access is only meaningful if the
   Clerk instance allows self-service sign-up. Restriction mode lives in the
   Clerk dashboard, not in this repository.
5. **Capacity.** One Fargate task (0.5 vCPU, 1 GB) on a `db.t4g.micro` single-AZ
   PostgreSQL is the current shape. The guard pins task size and the template
   pins `DesiredCount` to at most 1. Widening either is a template change that
   should follow observed load, not precede it.

## Evidence for the 2026-09-10 launch on the existing host

Source revision, sealed snapshot, CodeBuild identity, image digest, scan, and
stack updates are listed separately so a reader can tell provider evidence from
source evidence. All times America/Los_Angeles unless marked Z.

Source and snapshot:

- Reviewed commit: `928d20b5bf91d28bfc7cf7a64b08f35cbba9f97b` on `main`.
- `scripts/build-beta-source-snapshot.ps1`: snapshot commit
  `01c128f9b04905ef5ef58f5fec4582194b6fd4e3`, source tree `6209c865…`, 925
  files, 48,522,264 bytes, manifest SHA-256
  `95206934e8653ff397ffd0f6993b3cfe8d9685b76036d778015cfdbe77ce3086`, archive
  SHA-256 `97ec48edcd7f23e3409041721c9049fa171a28a907414d7b2be69317dea41976`.
  Real Git index unchanged.
- S3: `s3://secondbreakfast-build-source-051722405355/sources/secondbreakfast/public-launch-20260910/95206934….zip`,
  version `mYvoKBEi2KqaZugAOK2UeruF2He6b1ks`, S3-computed SHA-256 equal to the
  archive hash above.

Build and image:

- CodeBuild `secondbreakfast-web-build:746af80a-00a2-46b6-840f-aa7a9e19df59`,
  source override pinned to the object version above, `SOURCE_SHA256`
  override only; all other project environment unchanged (`PUBLIC_KEY_REQUIRED=true`,
  Clerk publishable key from Secrets Manager). `SUCCEEDED` 16:39:35.
- ECR `secondbreakfast-web` tag `95206934…`, digest
  `sha256:dd3475fb0d121918230d404a84b21ae81ab79ce5780c7b4c23d604c641ad5761`,
  265,227,964 bytes, BASIC scan `COMPLETE` with zero findings.

Stack updates (account `051722405355`, `us-east-2`):

- `skaldandstone-development-secondbreakfast-database`: `DeletionProtection=true`,
  `BackupRetentionDays=7`, other parameters previous values. `UPDATE_COMPLETE`;
  RDS reports deletion protection on and 7-day retention, instance `available`.
- `skaldandstone-development-secondbreakfast-runtime`: `CandidateImage` set to
  the digest above, `PublicAccess=true`, every other parameter previous value.
  `UPDATE_COMPLETE`. This produced candidate task definition revision 10 and
  rollback revision 18 (rollback keeps image `sha256:38394ffa…`).
- Because the template binds the ECS service to the rollback task definition,
  the stack update briefly moved `secondbreakfast-web` onto rollback:18 (old
  image, `SB_PUBLIC_ACCESS=true` present but ignored by that image). The service
  was then pointed at candidate:10 with `ecs update-service`; `services-stable`
  returned and the single running `web` container reports digest
  `sha256:dd3475fb…`. Future rollouts should expect this two-step behaviour or
  use `scripts/beta-release.ps1`.

Live verification, signed out, over the Cloudflare hostname:

- `/` returns 200 with `data-woodland="true"`, `<title>Savortome™</title>`, and
  the "Sign in to see the recipes you've saved" notice.
- `/sign-up` 200, `/discover` 200, `/care` 200 (public mode renders the care
  screen; before launch it redirected to sign-in).
- `/api/recipes` returns 401 signed out. Account data remains gated.
- The inlined Clerk key is still `pk_test_`: this launch runs on the Clerk
  development instance. See the owner gates above.

Not verified in this pass: a real self-service sign-up on the Clerk instance,
authenticated flows on the new image, Clerk dashboard restriction mode, load
behaviour, and any owner visual acceptance.

## Production Clerk cutover to savortome.skaldandstone.com, 2026-09-11

The 2026-09-10 launch above ran on the Clerk *development* instance at the
old hostname. This pass moved it to a production instance on the product's
own hostname.

Identity:

- Clerk application renamed to Savortome; production instance
  `ins_3JA04CTgisnnvlq1nMpUQpLOvnm` bound to `savortome.skaldandstone.com`,
  with its five CNAMEs in the live Cloudflare zone and DNS, SSL and mail
  verified by Clerk.
- Sign-up mode is `public` on both instances.
- The production secret key was rotated after an earlier probe printed one
  into an agent transcript; the rotated pair is stored in Secrets Manager at
  `dev/secondbreakfast/clerk-production`. The rotate endpoint returns the
  application, with the new key at `instances[].secret_key` - not a bare key,
  which is what `scripts/rotate-clerk-production-secret.ps1` now reads.
- The build takes the Clerk *publishable* key as a plain value rather than a
  Secrets Manager reference. It is public by definition: it is inlined into
  the browser bundle. Holding it as a secret bought nothing and required the
  CodeBuild role to hold a grant on every new secret.

Certificate and DNS: ACM `2fa45f4c-4190-418d-a135-828baf2ce6eb`, ISSUED for
`savortome.skaldandstone.com` with `beta.secondbreakfast.skaldandstone.com`
as a SAN, so the old hostname keeps working. Both are proxied to the ALB.

Images, both from sealed snapshots, BASIC scan COMPLETE with zero findings:

- `sha256:93b8ca316909368abf2889b528c310a627c2d130f8f07a872d043c1f3f9919e5`
  from manifest `77ff6f01...` (commit `aee23ec`). Image config verified before
  deploy: `pk_live_` inlined, user 65532, distroless node entrypoint, service
  worker on, cache version 3, source label matching the snapshot.
- `sha256:6a2c670d3da37e23f781a39850d4ee60e9fa89008542cd2ea6080dab4ba0d8e7`
  from manifest `9f4cb799...` (commit `833d39c`), carrying the sign-in gating
  fixes below. Running now, on candidate task definition revision 12.

### Three things a signed-out visitor could see

Found by James on the live site and fixed in `833d39c`.

1. **The kitchen pages were open.** `canUseBeta()` answered two different
   questions: which experience to render, and who may enter. Opening the beta
   to the public made it true for everyone, so `/cook` and `/care` rendered to
   strangers; `/list` and `/friends` had never had a check at all. `/plan`,
   `/profile`, `/templates` and `/recipe/new` did redirect, so the behaviour
   was inconsistent rather than designed. No account data was reachable at any
   point - API routes answer 401 and loaders return "sign in to see this" -
   but an empty kitchen shown to a stranger reads as broken.
   `apps/web/lib/page-auth.ts` is now a gate of its own, asked of Clerk
   directly. Verified signed out: `/cook`, `/list`, `/friends`, `/care`,
   `/plan`, `/profile`, `/templates`, `/recipe/new` all 307 to sign-in with
   the destination preserved; `/`, `/discover`, `/terms`, `/privacy`,
   `/accessibility`, `/plans` still 200.
2. **The legal pages froze the wrong shell.** `/terms`, `/privacy`,
   `/accessibility` and `/offline` had no dynamic export, so they were
   prerendered at build time when the runtime public-access flag is unset.
   That baked the pre-rebrand masthead into them and served it under
   `s-maxage=31536000`. A shell chosen by runtime configuration cannot be
   prerendered. All four are `force-dynamic` now and render the woodland
   shell; `data-woodland="true"` confirmed on the live pages.
3. **The masthead still advertised the old beta.** It linked to
   `skaldandstone.com/secondbreakfast/#request-access` and said "Request beta
   access", which was both the old name and untrue once sign-ups opened. It
   points at the Savortome page now. Separately, the Instacart handoff titled
   every list "Second Breakfast shopping list" in a third party's UI.

`second breakfast` now appears zero times in the HTML of `/`, `/terms`,
`/privacy`, `/accessibility`, `/plans`, `/discover` and `/offline`.

### Still open after this pass

- **No error monitoring.** Savortome has no Sentry or equivalent. A production
  sign-in failure would be invisible unless someone reports it.
- Google, Facebook and Apple SSO connections are unconfigured on the
  production instance; email and password is the only way in. Production Clerk
  will not accept Clerk's shared development OAuth credentials.
- No authenticated flow has been exercised against the production instance: no
  real sign-up, no import while signed in, no owner acceptance.
