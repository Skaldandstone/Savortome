# Account and admission migration

Status: reviewed local source and read-only cloud evidence, 7 September 2026. No runtime, DNS, secret, payment, invitation, or deployment change was made.

## Admission contract

Prospective testers request access from the existing [Studio Second Breakfast page](https://skaldandstone.com/secondbreakfast/#request-access). The current non-beta navigation links to that form. James reviews each request in the Studio owner queue. Approval creates or updates the matching Clerk user and records this public metadata:

```json
{
  "studio_access": {
    "second-breakfast": {
      "approved": true
    }
  }
}
```

The web gate now accepts that exact server-read metadata only when `SB_BETA_ENABLED=true`. It verifies that the Clerk user returned by the Backend API has the same ID as the authenticated session. Missing, malformed, false, wrong-product, mismatched-user, or unavailable Clerk results deny access. A comma-separated `SB_BETA_CLERK_USER_IDS` list remains an optional recovery override for exact user IDs. It is not the normal enrollment workflow. Email domain, email text, display name, client state, and arbitrary metadata do not grant access.

The request form and owner approval queue live in the Studio access-request service. Second Breakfast does not send invitations itself and does not broaden Clerk sign-up. Hosted acceptance must still prove request, approval, sign-in, denial before approval, revocation, account switching, session expiry, and Backend API failure against the correct Clerk instance.

## Sole AWS target

All new Second Breakfast AWS work targets account `051722405355`, region `us-east-2`, through profile `skaldandstone-admin`. Accounts `734702670689` and `574921529762` are historical evidence only and are retired for new work.

Read-only inspection in `051722405355` established:

- ECR repository `secondbreakfast-web` exists and is immutable.
- Candidate digest `sha256:bfb6f728aac3f545db1616e8ea50e232234bdd6337b0198cdb64fcd302cbb5ff` is present as a byte-identical migration. Its config digest is `sha256:1336c885918997d652f9fa49dc8b6cd6187743a78f351fb0cc65a96168ddb452`, and the account-local ECR BASIC scan completed with zero findings. This is not enhanced Inspector coverage.
- ACM certificate `arn:aws:acm:us-east-2:051722405355:certificate/d93bcaed-e77a-4a56-b872-a6e6bf2f639e` covers `beta.secondbreakfast.skaldandstone.com` and is pending validation.
- Shared ECS cluster `skaldandstone-production` exists.
- No Second Breakfast ECS service, CloudFormation stack, CodeBuild project, source bucket, runtime secret, database secret, or reviewed Cloudflare prefix list exists.
- The reviewed privacy-v3 rollback digest is not present in this account.

The migrated candidate does not need a rebuild merely to reproduce its bytes. The release verifier requires same-account immutable source, build, configuration, and scan evidence, so the safest release path is a new sealed-source build in `051722405355`. A cross-account migration attestation would require an explicit verifier design and separate review. The rollback image must be rebuilt or migrated, independently verified, and scanned before any service can be prepared.

The CloudFormation proposal now accepts only account `051722405355`, the existing shared cluster, the pending account-local certificate, the exact migrated candidate digest, and a new-account rollback digest. Clerk and database secret ARNs have no defaults. The activation gate, desired count zero, beta-off default, Cloudflare-only ingress, nonpublic database, expiry controller, privacy-v3 image checks, and disabled Stripe settings remain mandatory.

## Remaining release work

1. Seal the current reviewed source and recreate versioned S3 plus CodeBuild provenance in `051722405355`.
2. Produce and scan a privacy-v3 rollback image in the same account.
3. Validate the ACM certificate and provision a reviewed Cloudflare IPv4 prefix list.
4. Provision runtime Clerk and database secrets through the approved secret workflow. Do not expose secret values in operator output or committed evidence.
5. Validate the inert CloudFormation change set, expiry controller, and database lifecycle before creating a desired-count-zero service.
6. Exercise owner-approved and denied Clerk users, revocation, account switching, expired sessions, failed writes, service-worker update/logout privacy, and rollback on the private HTTPS endpoint.
7. Keep Stripe checkout and livemode false. No paid runtime or live billing is approved.
