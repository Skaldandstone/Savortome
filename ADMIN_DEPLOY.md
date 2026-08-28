# Deploying the admin API

This covers the staff/CS admin surface added on `claude/admin-api`: the
`/api/admin/*` routes under `apps/web/app/api/admin/`, their `withAdmin` gate
(`apps/web/lib/admin.ts`), the admin query module
(`packages/db/src/queries/admin.ts`), and the Stripe refund flow. Second
Breakfast has never been deployed to a host — see the **Deploying**
section of `README.md` for the general host constraints (Clerk mandatory in
prod, `yt-dlp`/`ffmpeg` on the box, `NEXT_PUBLIC_*` at build time). This doc
adds only what the admin surface needs on top of that.

## What ships

- `apps/web/lib/admin.ts` — `withAdmin` compares `X-Admin-Token` against
  `ADMIN_API_TOKEN` with `timingSafeEqual`; no token set ⇒ every admin route
  refuses. Runs on the Node runtime (`export const runtime = "nodejs"`).
- `packages/db/src/queries/admin.ts` — read helpers plus the refund helpers
  (`purchaseForRefund`, `adminPurchases`, `claimRefund`,
  `releaseRefundClaim`, `finalizeRefund`) and moderation
  (`setUserStatus`, `setReviewHidden`).
- Routes under `apps/web/app/api/admin/`: `users/[id]/{route,billing,credits,
  tier,imports,status,refund}`, `reviews/{route,hide}`, `imports/failures`.
- **Refund guardrails** (`users/[id]/refund/route.ts`): a hard per-refund cap
  (`SB_REFUND_CAP_CENTS`, default `20000` = $200), single-use (a purchase
  already carrying `refundedAt` is refused), and clawback of the still-unspent
  purchased credits. Because the Neon HTTP driver has no interactive
  transactions, the flow is **claim-first**: `claimRefund` conditionally sets
  `refunded_at` (`WHERE refunded_at IS NULL`) *before* Stripe is touched, so a
  double-click or concurrent refund can never reach Stripe twice; a Stripe
  failure calls `releaseRefundClaim` to allow a retry.

## Two additive migrations

Both are additive (new nullable columns / enum) with no backfill, safe to run
before the new code is live:

- `0009` — `users.status` (userStatus enum: active | suspended | banned) and
  `ratings.hidden_at`.
- `0010` — `credit_purchases.refunded_at` and `credit_purchases.refunded_cents`.

Run them against the production Neon database before first boot of the new
build:

```bash
DATABASE_URL=<production-neon-url> pnpm db:migrate
```

## Environment

On top of the base app env (Clerk, `DATABASE_URL`, Stripe, etc.):

| Var | Purpose | Notes |
|---|---|---|
| `ADMIN_API_TOKEN` | Gates every `/api/admin/*` route | `openssl rand -hex 32`. Must equal the portal Worker's `SB_ADMIN_TOKEN`. |
| `SB_REFUND_CAP_CENTS` | Hard per-refund ceiling | Optional; defaults to `20000` ($200). Set lower to tighten. |
| Stripe secret key | Refunds call `stripe().refunds.create` | Refund route throws if Stripe isn't configured — it never silently no-ops. |

Set `ADMIN_API_TOKEN` in the deployed environment (Vercel/Netlify project env,
or the container/VM's env), then put the **same value** into the portal Worker
so its Second Breakfast proxy can authenticate:

```
grok-adminhelper secret  SB_ADMIN_TOKEN = <same token>
```

(See `ginnungagap/infra/adminhelper/DEPLOY.md`.)

## Verify

```bash
BASE=https://<deployed-origin>

# No/blank token ⇒ 401/403.
curl -s -o /dev/null -w '%{http_code}\n' "$BASE/api/admin/users?q=test"

# With the token ⇒ 200 JSON.
curl -s -H "X-Admin-Token: $ADMIN_API_TOKEN" "$BASE/api/admin/users?q=@" | head -c 400
```

Then exercise the Second Breakfast tab at grok.skaldandstone.com/adminhelper —
a user search proves the Worker→`SB_ADMIN_TOKEN`→app path; the billing view
shows purchases with their refund state, and the Refund button walks the
claim→Stripe→finalize path with the cap and clawback applied. Every write is
audited to the D1 log on the Worker side.

## Notes

- **Refund testing:** do a live refund against a real Stripe **test-mode**
  payment first. The route resolves the payment intent from the checkout
  session, so a purchase with no `stripeSessionId` (or never fulfilled) is
  correctly refused rather than half-processed.
- **Rotating the token**: change `ADMIN_API_TOKEN` in the app environment and
  redeploy, then update `SB_ADMIN_TOKEN` on the Worker (Worker second, so the
  portal never holds a token the app has already stopped accepting).
