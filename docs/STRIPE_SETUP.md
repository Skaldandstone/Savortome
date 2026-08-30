# Second Breakfast Stripe sandbox setup

Use the existing Skald and Stone sandbox. Its account ID and catalog still need
verification after sign-in. This branch does not provision Stripe objects,
inject credentials, deploy, or enable beta payments.

Inventory existing objects before creating these distinct Products/Prices:

| Product | USD | Cadence | Variable |
| --- | ---: | --- | --- |
| Second Breakfast Plus | 29.99 | Year | STRIPE_PRICE_PLUS_ANNUAL |
| Second Breakfast Pro | 49.99 | Year | STRIPE_PRICE_PRO_ANNUAL |
| Second Breakfast 25 import credits | 2.99 | Once | STRIPE_PRICE_PACK_25 |
| Second Breakfast 100 import credits | 10.99 | Once | STRIPE_PRICE_PACK_100 |

Inject these values into the web service's secrets/configuration store or an
ignored local environment file. Never commit secrets or paste them into chat.

```dotenv
STRIPE_SECRET_KEY=rk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_LIVEMODE=false
STRIPE_CHECKOUT_ENABLED=false
STRIPE_PRICE_PLUS_ANNUAL=price_...
STRIPE_PRICE_PRO_ANNUAL=price_...
STRIPE_PRICE_PACK_25=price_...
STRIPE_PRICE_PACK_100=price_...
STRIPE_PORTAL_CONFIGURATION_ID=bpc_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Use a project-specific restricted key with the permissions required by Checkout,
customers, subscriptions, and portal sessions. Separate keys do not isolate
objects within an account. Set STRIPE_CHECKOUT_ENABLED=true only on a deliberate
sandbox test instance. Leave the free beta disabled. Use the verified test
instance origin for return URLs. Sandbox setup is not production price approval.

The server-rendered plans page passes only public availability to the client:
purchasable application product IDs, explanatory text, and a portal boolean.
Prices and secrets are never included in those props. During the free beta,
Choose and top-up buttons are disabled with a visible explanation before a
click. Missing keys, webhook configuration, database, sign-in, or an individual
price also disable affected purchases. Manage billing is hidden unless the
current viewer has their own stored customer and the portal/key are configured.
Existing customers can still manage billing when new checkout is disabled.
Server API authorization and configuration guards remain authoritative.

Create a separate webhook destination at the verified web host's
/api/billing/webhook and use its signing secret. Subscribe to:

- checkout.session.completed
- checkout.session.async_payment_succeeded
- checkout.session.async_payment_failed
- customer.subscription.updated
- customer.subscription.deleted

Create a Second Breakfast portal configuration with invoice history,
payment-method updates, and cancellation at period end. Keep plan changes
disabled until price-based subscription changes are implemented and verified.
The plans page's Manage billing button opens only the signed-in user's stored
customer. A browser-supplied customer ID is never used.

Checkout uses stable Price IDs and adds app=secondbreakfast, userId, and
productId metadata. Webhooks ignore objects without the project marker. Before
adopting this on an existing paid deployment, reconcile legacy subscriptions,
Sessions, and stuck event claims. Do not retag unrelated account objects.
Signed event modes and key prefixes must match STRIPE_LIVEMODE.

The installed Stripe SDK 22.5.0 targets API 2026-07-29.dahlia. Checkout sends
integration_identifier=secondbreakfast-web-checkout-fpkhuarf for both subscription
and credit-pack Sessions. The eight-letter suffix was randomly generated once
for this integration; keep the label stable across requests and deployments so
Dashboard comparisons remain grouped. It contains no customer or Session data
and is not an idempotency key.

Invalid webhook signatures still receive HTTP 400 without processing. Non-2xx
responses can trigger Stripe retries; 400 does not instruct Stripe to stop.
See [Stripe's webhook delivery behavior](https://docs.stripe.com/webhooks?lang=node#automatic-retries).

An unpaid completed Session grants nothing. Paid or no-payment-required
Sessions can fulfil; delayed success is handled. Delayed failure grants nothing.
See [Stripe's fulfilment guidance](https://docs.stripe.com/checkout/fulfillment).

The receipt, customer link, purchase, credit grant, and fulfilment marker now
commit together. A purchase-row lock and unique Session ID prevent distinct
events from granting the same purchase twice. Historical records are not
automatically repaired.

From the repository root:

```powershell
pnpm --filter @seconds/core test
pnpm --filter @seconds/db test:billing
pnpm --filter @seconds/web typecheck
pnpm --filter @seconds/db typecheck
```

The database test uses ephemeral PGlite PostgreSQL and never reads DATABASE_URL.
It verifies rollback after a simulated post-grant failure and repeat Session
fulfilment. It does not prove RDS multi-connection locking, actual Stripe
purchases, hosted delivery, portal browser behavior, or refunds. Verify these
in the sandbox before any live rollout. Review tax registrations, product tax
codes, and inclusive/exclusive pricing before enabling automatic tax; see
[Stripe's recurring tax setup](https://docs.stripe.com/billing/taxes/collect-taxes).
