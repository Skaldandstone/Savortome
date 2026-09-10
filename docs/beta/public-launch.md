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

Recorded below as each step completes. Source revision, sealed snapshot,
CodeBuild identity, image digest, scan, and stack update are listed separately
so a reader can tell provider evidence from source evidence.
