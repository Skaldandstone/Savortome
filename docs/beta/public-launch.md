# Public launch switch and production readiness

## Guest Care and physical-device release, 21 September 2026

PR [#96](https://github.com/Skaldandstone/Savortome/pull/96) restored immediate
signed-out Care while leaving account pages, account APIs, saved settings, and
shopping writes behind their existing authentication boundaries. All three CI
jobs passed before merge. `main` and `origin/main` advanced to merge commit
`ec0fc45f26890d008893e6cb0baaf943074a2beb`.

The merged source was sealed without changing the real Git index:

- snapshot commit `1d218d45a54590c7740aaf24a6c8d29555ae9988`
- source tree `f580ba329e13e7088310f1ac6932d67651fda69d`
- 1,002 source files
- manifest SHA-256
  `2f1d3cea805dbcef63b7d0c52a4ec5c2943ae1c3ffefa07e80455e4ba84e06af`
- archive SHA-256
  `9b028a8b54a738479045d867b000f0bd1dc153c81011fd5d0ec9baa67e92e00e`
- versioned S3 source
  `sources/secondbreakfast/savortome-guest-care-20260921/2f1d3cea805dbcef63b7d0c52a4ec5c2943ae1c3ffefa07e80455e4ba84e06af.zip`,
  version `g0sarHvkSLe9h3bnDRd69y7WnwDtJ3HH`, AES256 encrypted and still marked
  `release-approved=false`

CodeBuild `secondbreakfast-web-build:f097ab50-ae8f-4f45-a1bd-279ebe7107dc`
built the exact pinned object. A preceding invocation
`15e2ee47-6a4e-4a89-9469-d1f309b44ed5` received the literal string
`$manifest` because of PowerShell argument quoting; the trusted pre-build guard
rejected it before Docker. The successful invocation changed only the quoted
environment override.

The resulting image is
`051722405355.dkr.ecr.us-east-2.amazonaws.com/secondbreakfast-web@sha256:4fb60cc81481edea8386655ad1f8ee8bb82e29f63b4c1f55e024753a929da76a`,
config digest
`sha256:2c1dca2e700a5870484e754956a3e87981fb3e7e2566a96bea222b214fd86663`.
The release verifier confirmed the exact CodeBuild source, S3 checksum, inline
buildspec, nonroot distroless runtime, live Clerk public key, service worker,
privacy cache version 3, OCI source labels, and a COMPLETE zero-finding BASIC
ECR scan. The previously running web image `sha256:fbd81644...7fbaa` was
independently reverified and pinned as the technical rollback.

The reviewed release packet registered candidate revision 25 without changing
desired count, networking, roles, sidecars, schedule, billing flags, or secret
references. ECS stabilized at desired/running count 1 with one completed
deployment. The running web container reports the exact candidate digest and
the ALB target is healthy. `SB_BETA_ENABLED` and `SB_PUBLIC_ACCESS` remain true;
`STRIPE_CHECKOUT_ENABLED` and `STRIPE_LIVEMODE` remain false.

Fresh signed-out probes against `https://savortome.skaldandstone.com` verified:

- `/care?source=direct&effort=open&time=ten` returns 200 and renders **Feed me
  gently** in the woodland shell.
- `/cook`, `/list`, `/friends`, `/plan`, `/profile`, `/templates`, and
  `/recipe/new` return 307 to sign-in with their destination preserved.
- `/api/recipes` returns 401 with private, no-store caching.
- `/`, `/discover`, `/privacy`, `/terms`, and `/accessibility` return 200 with
  the Savortome woodland shell and no **Second Breakfast** text.
- The compatibility beta hostname also returns guest Care 200.
- A fresh Chromium context installed and controlled privacy-v3 `sw.js`. Its
  only cache was `seconds-public-v3`; no `/care` response or API entered it.
  Offline Care rendered the generic fallback, and the online
  `/care-offline.html` URL remained 404 even though the worker uses that path as
  an internal synthetic cache key.

The matching ARM64 review APK and physical Samsung tablet results are in
[physical-device-evidence.md](physical-device-evidence.md). This rollout does
not close signed-in account/device testing, TalkBack traversal, receipt camera
and gallery capture, grocery-provider connectivity, email-client rendering, or
owner visual acceptance.

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

- ~~No error monitoring.~~ Wired 2026-09-11; see below.
- Google, Facebook and Apple SSO connections are unconfigured on the
  production instance; email and password is the only way in. Production Clerk
  will not accept Clerk's shared development OAuth credentials.
- No authenticated flow has been exercised against the production instance: no
  real sign-up, no import while signed in, no owner acceptance.

## Error monitoring, 2026-09-11

A `secondbreakfast-web` Sentry project already existed in the
`skald-and-stone` org and had never been connected to anything. It is wired
now, in image
`sha256:4eead811d6ea1ff7930376436bedaa62474be389f15f83f759a5125e67674dd4`
(commit `fd4412e`, candidate task definition revision 13).

What is deliberately not sent, because of what this app knows: identity,
breadcrumbs, request bodies, headers, cookies, session replay and performance
tracing are all off, and `beforeSend` drops the URL. A recipe path carries an
id; a `/care` URL carries the handoff that says how much energy someone has
and what they can keep down. Events carry the exception, the stack and the
route name. Offline fetch failures are ignored, since the offline shell fails
those on purpose.

The DSN is a parameter rather than a secret - it can only send events to one
project, never read them - and is rendered into a meta tag at request time so
the value follows the running task. The template default is empty, so no
stack update can start reporting by accident. Source-map upload is off: it
would need a `SENTRY_AUTH_TOKEN` inside the fail-closed image build.

Verified: the meta tags render on the live site with the production DSN and
`environment=production`; a deliberately labelled test event reached the
project as `SECONDBREAKFAST-WEB-1` and was resolved with a note. Not yet
verified: an error originating inside the running app, which will be the
first genuine fault.

## Grocery token AAD deploy, 2026-09-12

PR #77 (bind grocery OAuth tokens to their row with AAD) reached the running
service. Until this deploy the fix was merged but not serving: the live image
still carried the pre-AAD crypto.

- Image `sha256:809fd372240d231f4873280a905c2a1ebefdfa44c460b92f4d77503dbaa0a38c`,
  built from sealed manifest `518e34c4…` at commit `a32ad3d` (the PR merge).
  BASIC scan COMPLETE, zero findings. Config verified before deploy: `pk_live_`
  inlined, nonroot user 65532.
- Runtime stack updated with that `CandidateImage`, every other parameter
  previous value. Candidate task definition revision 14; the service was then
  pointed at it and `services-stable` returned with the running container
  reporting the same digest.
- The image is one commit behind `main`, which has since taken only the
  `docs/beta/checks/grocery-aad-check.txt` evidence file. No code differs.

Verified signed out afterwards: `/`, `/discover` and `/terms` return 200 in the
woodland shell with the Sentry DSN meta tag present; `/cook`, `/list`,
`/friends` and `/care` all 307 to sign-in; `/api/recipes` returns 401; the
inlined Clerk key is `pk_live_`.
