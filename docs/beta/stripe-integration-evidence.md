# Stripe integration review, 30 August 2026

Integrated the source changes from `27642cad8f8153a1bae30fbfae1a7f7494cd8ec0` and `001cb5a6f64c372c22f2c6cbf83bf6eac7c8976f` into the working beta branch. The original commits remain on isolated branch `codex/stripe-sandbox-hardening`. Integration used a checked patch, not a branch switch or reset. Existing woodland CSS, mobile changes, database TLS policy and recipe transactions were retained. The environment example was merged manually; no local secret files changed.

Checkout remains off unless explicitly enabled server-side. Sandbox mode is the default, and wrong-environment keys and signed events are rejected. Plans displays a free-beta notice with unavailable paid controls disabled. Portal access needs the authenticated viewer's own customer record and configured portal. The client receives availability booleans and known app product IDs, not credentials or Stripe customer/Price IDs.

Fulfillment waits for a paid or no-payment-required Session marked for this product. The event receipt, customer link, purchase, credit grant and fulfillment marker commit together. Session uniqueness and row locking prevent distinct events granting the same purchase twice. Credit packs preserve an existing subscription ID. No schema migration is required. See `../STRIPE_SETUP.md` for configuration, portal limitations and historical reconciliation requirements.

## Independent validation

- Ran the isolated PGlite billing regression successfully before integration: one test covering injected post-grant failure, rollback, retry, repeated event and distinct-event Session deduplication.
- Added `packages/db/scripts/check-beta-billing.ts` with the exact disposable local database URL guard and UUID-owned fixtures. It makes no Stripe requests and removes its own users, events, trigger and function in cleanup.
- Ran that check against the previous billing implementation first. It failed because 25 credits remained after an injected fulfillment-marker failure. The regression evidence is `checks/stripe-postgres-before.txt`.
- Ran the same check after integration. All five scenarios passed, including rollback of the customer link and event receipt, retry, concurrent event deduplication, preservation of a subscription, and isolation of another user. Two actual PostgreSQL connections were held at a controlled lock barrier while fulfilling one pending Session; only one grant committed. See `checks/stripe-postgres-after.txt`.

The successful database check used PostgreSQL 17 on loopback port 55494, database `seconds_beta`. This validates local PostgreSQL transaction/locking behavior, not production RDS configuration or hosted webhooks. The installed pg driver emits a deprecation warning for existing concurrent reads on one transaction client; all assertions and cleanup completed with exit code 0. Review that read pattern before upgrading to pg 9.

## Repeat the local check

From the canonical repository in PowerShell, with the disposable database already running:

```powershell
$env:DATABASE_URL='postgresql://sb_beta@127.0.0.1:55494/seconds_beta'
node packages/db/node_modules/tsx/dist/cli.mjs packages/db/scripts/check-beta-billing.ts
```

The equivalent package script is `pnpm --filter @seconds/db check:beta-billing`. During parallel work, prefer the direct Node command: installed pnpm 11 can automatically synchronize dependencies even for `exec` or a test command when manifests/lockfiles changed. Two concurrent commands did that during integration, producing one transient missing Drizzle file. Synchronization completed, the file was present without manual repair, and the direct Node retry passed. The native dependency graph did not change.

## Still not validated

At this source checkpoint the Stripe account and catalog were still unverified. A later read-only test-key audit, recorded in `checks/stripe-sandbox-readonly.json`, verified the expected account, four exact app-scoped Products and Prices, and compatible active portal configurations. Authenticated portal browser flow, hosted webhook delivery, RDS locks, refunds and historical reconciliation remain unverified, and no webhook endpoint exists. No real charges, purchases, Stripe mutation, key injection or live setting change occurred. Keep `STRIPE_CHECKOUT_ENABLED=false` and `STRIPE_LIVEMODE=false`. Portal plan changes remain disabled. Tax registration and configuration need separate review before any paid release; this work did not enable automatic tax.
