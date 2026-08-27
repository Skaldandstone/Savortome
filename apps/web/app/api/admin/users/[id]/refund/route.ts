import {
  adminUserById,
  claimRefund,
  creditsFor,
  finalizeRefund,
  purchaseForRefund,
  releaseRefundClaim,
} from "@seconds/db";
import { readJson } from "@/lib/api";
import { withAdmin } from "@/lib/admin";
import { stripe, stripeConfigured } from "@/lib/stripe";

/**
 * Staff refund against a specific purchase, with real-money guardrails:
 *  - a hard per-refund cap (SB_REFUND_CAP_CENTS, default $200),
 *  - single-use: a purchase already carrying refundedAt is refused,
 *  - clawback of the still-UNSPENT purchased credits, so a refund can't be
 *    followed by spending what was refunded. Spent credits are not clawed
 *    back — that value is already delivered and is the refund's cost.
 * The refund itself goes to Stripe against the purchase's payment intent.
 */
export const runtime = "nodejs";

const DEFAULT_CAP_CENTS = 20_000;

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await readJson<{ purchaseId: string; cents?: number }>(request);
  return withAdmin(request, async (database) => {
    if (!stripeConfigured()) throw new Error("Stripe is not configured; cannot issue refunds.");
    if (!body.purchaseId) throw new Error("purchaseId is required");
    if (!(await adminUserById(database, id))) return undefined;

    const purchase = await purchaseForRefund(database, id, body.purchaseId);
    if (!purchase) throw new Error("Purchase not found for this user");
    if (!purchase.fulfilledAt) throw new Error("Purchase was never fulfilled; nothing to refund");
    if (purchase.refundedAt) throw new Error("This purchase has already been refunded");
    if (!purchase.stripeSessionId) throw new Error("Purchase has no Stripe session to refund against");

    const cap = Number(process.env.SB_REFUND_CAP_CENTS) || DEFAULT_CAP_CENTS;
    const requested = body.cents == null ? purchase.cents : Math.trunc(Number(body.cents));
    if (!Number.isFinite(requested) || requested <= 0) throw new Error("Refund amount must be positive");
    if (requested > purchase.cents) throw new Error("Refund cannot exceed the amount charged");
    if (requested > cap) throw new Error(`Refund exceeds the per-refund cap of ${cap} cents`);

    // Resolve the payment intent from the checkout session.
    const session = await stripe().checkout.sessions.retrieve(purchase.stripeSessionId);
    const paymentIntent =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;
    if (!paymentIntent) throw new Error("No payment intent found on the checkout session");

    // Clawback = the portion of THIS purchase's credits that is still unspent,
    // never more than the account's current purchased balance. Read before the
    // claim so it reflects the pre-refund state.
    const balance = await creditsFor(database, id);
    const clawback = Math.min(purchase.credits, balance.purchasedLeft);

    // Claim BEFORE touching Stripe: a lost claim means someone else is already
    // refunding this purchase, so we never issue a second Stripe refund.
    if (!(await claimRefund(database, purchase.id))) {
      throw new Error("This purchase is already being refunded");
    }

    let refund;
    try {
      refund = await stripe().refunds.create({
        payment_intent: paymentIntent,
        amount: requested,
        metadata: { purchaseId: purchase.id, source: "adminhelper" },
      });
    } catch (err) {
      // Stripe rejected it — release the claim so it can be retried.
      await releaseRefundClaim(database, purchase.id);
      throw err;
    }

    await finalizeRefund(database, id, purchase.id, requested, clawback);
    const after = await creditsFor(database, id);
    return {
      refundedCents: requested,
      clawedBackCredits: clawback,
      stripeRefundId: refund.id,
      balance: after,
    };
  });
}
