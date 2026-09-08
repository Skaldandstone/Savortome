# Second Breakfast Stripe sandbox setup

Use the existing Skald and Stone test environment. A read-only API audit on
31 August verified the configured test account, all four active app-scoped
Products and Prices, and active portal configurations. The exact evidence is
`docs/beta/checks/stripe-sandbox-readonly.json`. This branch does not create or
modify Stripe objects, inject a webhook secret, deploy, or enable beta payments.

The Stripe connector still needs owner reauthentication. The audit used the
existing restricted test key from AWS Secrets Manager without printing it.
Existing source prices below match the current test catalog; that match is not
new commercial approval. Checkout remains disabled.

The verified test catalog contains these distinct Products and Prices. Do not
create duplicates:

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
customers, Prices/Products, subscriptions, and portal sessions. The application
now reads expanded catalog products and current subscriptions as well as creating
hosted sessions. Separate keys do not isolate
objects within an account. Set STRIPE_CHECKOUT_ENABLED=true only on a deliberate
sandbox test instance. Leave the free beta disabled. Use the verified test
instance origin for return URLs. Sandbox setup is not production price approval.

The server-rendered plans page passes only public availability to the client:
purchasable application product IDs, explanatory text, and a portal boolean.
Stripe Price IDs and secrets are never included in those props. During the free beta,
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

No test webhook endpoint exists yet. Do not create one until the private HTTPS
host is working and its exact origin is fixed. Store the resulting signing
secret in the selected development account's Secrets Manager and inject only
the `STRIPE_WEBHOOK_SECRET` JSON key. Keep checkout disabled while testing
signature rejection, duplicate delivery, delayed success, and failed delivery.

Select one of the verified active test portal configurations with invoice
history, payment-method updates, cancellation at period end, and subscription
updates disabled. Keep plan changes disabled until the hosted upgrade and
downgrade paths are verified with the owner.
The plans page's Manage billing button opens only the signed-in user's stored
customer. A browser-supplied customer ID is never used.

Price-based changes are now implemented and locally regression-tested. Keep
portal plan changes disabled until the exact sandbox configuration and both
upgrade/downgrade flows have been verified with the owner. Each configured Price
must be unique across this app's four product variables, in the matching Stripe
environment, USD, and match the existing source amount/cadence. Plans require
one licensed annual unit; packs require one one-time unit. The expanded Stripe
Product must carry `metadata.app=secondbreakfast`. Unknown, foreign, multi-item,
wrong-currency or wrong-cadence subscriptions receive no paid tier. Do not reuse
another product's Price or Customer because the business shares a Stripe account.

Every Customer and Subscription must carry `metadata.app=secondbreakfast` and
the app's internal user UUID in `metadata.userId`. Checkout sets these ownership
fields; the webhook never adopts an arbitrary customer link from metadata alone.
Existing unmarked records require deliberate reconciliation before enabling this
code on a paid deployment. Portal and Checkout refuse deleted, foreign-owner or
wrong-environment Customers.

The webhook verifies the unchanged raw body with the installed Stripe SDK before
claiming an event. The claim, purchase, entitlement and fulfillment marker share
one transaction. An account row lock serializes billing changes; current Stripe
state is retrieved after acquiring it. Only Checkout can establish a new
subscription link, and subscription events must name that exact linked identity.
Old subscription cancellation cannot downgrade a replacement. Delayed duplicate
Checkout events cannot restore an old link. Unpaid/paused subscriptions retain
their identity so recovery can restore the same plan; the existing `past_due`
grace policy is unchanged. Unknown catalog entries fail closed rather than using
metadata to guess Plus. Stripe network errors roll back and return retryable 500;
logs do not include SDK response bodies or customer metadata.

New plan Checkout checks current subscriptions, including those whose webhook
has not arrived, and reuses an already-open matching plan Checkout. It refuses
another pending plan or a nonterminal subscription. First Customer creation has
a stable owner-scoped idempotency key. No automatic subscription renewal loop,
new metering service, tax collection or price creation is added.

Production return configuration must be an HTTPS origin with no credentials,
path, query or fragment. Loopback HTTP is permitted only outside production.
The request Host and browser-supplied customer/price/amount are never used.

AWS secrets belong in the selected deployment account's Secrets Manager or
SSM SecureString, coordinated with the cloud owner, and injected through the
existing service's secret references. No secrets were provisioned here. The new
company development account has no Second Breakfast runtime yet; do not point
the mobile build or webhook at it until a reviewed service is deployed.

Current offline checks from the repository root, with no package installation:

```powershell
node --import ./packages/db/node_modules/tsx/dist/loader.mjs scripts/check-stripe-lifecycle.mjs
$env:DATABASE_URL='postgresql://sb_beta@127.0.0.1:55494/seconds_beta'
node --import ./packages/db/node_modules/tsx/dist/loader.mjs packages/db/scripts/check-beta-billing.ts
```

The first command uses actual route/fulfillment code, the real Stripe signature
verifier and disposable PGlite, mocking only HTTP/auth/framework boundaries. The
second has an exact disposable-DB guard and exercises separate PostgreSQL
connections. Neither validates the hosted sandbox, real Clerk sessions, refunds,
disputes, portal rendering or tax registrations. Full evidence is in
`docs/beta/overnight-integration.md`.

Current official references, read with Stripe CLI 1.50.6 on 31 August:
[webhook signatures, retries and ordering](https://docs.stripe.com/webhooks),
[subscription state and events](https://docs.stripe.com/billing/subscriptions/webhooks),
[recurring tax setup](https://docs.stripe.com/billing/taxes/collect-taxes).
Tax registrations, product tax codes and inclusive/exclusive pricing still need
owner/adviser review. Automatic tax is not enabled and tax readiness is not claimed.

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
