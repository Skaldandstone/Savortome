import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { isHandledEvent } from "@seconds/core";
import { claimStripeEvent, db } from "@seconds/db";
import { requireWebhookSecret, stripe, stripeConfigured, webhookConfigured } from "@/lib/stripe";
import { fulfillStripeCheckout, syncStripeSubscription } from "@/lib/stripe-fulfillment";
import { databaseConfigured } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!stripeConfigured() || !webhookConfigured()) return NextResponse.json({ error: "Payments are not configured." }, { status: 501 });
  if (!databaseConfigured()) return NextResponse.json({ error: "No database to record the purchase in." }, { status: 500 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing stripe-signature." }, { status: 400 });

  // Verify the unchanged raw body before reading metadata, claiming or granting.
  const payload = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(payload, signature, requireWebhookSecret());
  } catch {
    return NextResponse.json({ error: "Signature verification failed." }, { status: 400 });
  }
  if (event.livemode !== (process.env.STRIPE_LIVEMODE === "true")) return NextResponse.json({ error: "Stripe environment does not match." }, { status: 400 });
  if (!isHandledEvent(event.type)) return NextResponse.json({ received: true, handled: false });

  try {
    const handled = await db().transaction(async database => {
      if (!(await claimStripeEvent(database, event.id, event.type))) return false;
      switch (event.type) {
        case "checkout.session.completed":
        case "checkout.session.async_payment_succeeded":
          await fulfillStripeCheckout(database, stripe(), event.data.object);
          break;
        case "checkout.session.async_payment_failed":
          break; // Pending payments did not receive credits.
        case "customer.subscription.updated":
        case "customer.subscription.deleted":
          await syncStripeSubscription(database, stripe(), event.data.object);
          break;
      }
      return true;
    });
    return NextResponse.json({ received: true, handled, ...(!handled ? { duplicate: true } : {}) });
  } catch {
    // Do not dump customer data or SDK response objects. All writes and the
    // receipt roll back, so a Stripe retry receives a fresh attempt.
    console.error("Stripe fulfillment failed", { eventId: event.id, type: event.type });
    return NextResponse.json({ error: "Fulfilment failed. Please retry." }, { status: 500 });
  }
}
