import { NextResponse } from "next/server";
import { formatCents, productById, TIER_LABEL } from "@seconds/core";
import { linkStripeCustomer } from "@seconds/db";
import { readJson, withUser } from "@/lib/api";
import { appOrigin, stripe, stripeConfigured } from "@/lib/stripe";

/**
 * Start a checkout.
 *
 * The request names a product; the server decides what it costs. The client
 * never sends a price, a credit count, or a tier — those are looked up here
 * from the one table that defines them, because a client that can name its own
 * price will eventually name zero.
 */
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await readJson<{ productId?: string }>(request);
  const product = body.productId ? productById(body.productId) : undefined;

  if (!product) {
    return NextResponse.json(
      { error: "That isn't something you can buy." },
      { status: 400 },
    );
  }

  if (!stripeConfigured()) {
    return NextResponse.json(
      {
        error:
          "Payments aren't set up yet. Set STRIPE_SECRET_KEY in .env.local to enable checkout.",
      },
      { status: 501 },
    );
  }

  return withUser(async (userId, database) => {
    const client = stripe();

    const user = await database.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, userId),
      columns: { email: true, stripeCustomerId: true },
    });

    // Reuse the customer so someone's purchases stay on one record in Stripe
    // rather than scattering across a new customer per checkout.
    const customerId =
      user?.stripeCustomerId ??
      (await client.customers.create({ email: user?.email, metadata: { userId } })).id;

    if (customerId !== user?.stripeCustomerId) {
      await linkStripeCustomer(database, userId, customerId);
    }

    const isPlan = product.kind === "plan";
    const name = isPlan
      ? `Second Breakfast — ${TIER_LABEL[product.tier!]}`
      : `${product.credits} AI import credits`;

    const session = await client.checkout.sessions.create({
      mode: isPlan ? "subscription" : "payment",
      customer: customerId,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: product.cents,
            ...(isPlan ? { recurring: { interval: "year" as const } } : {}),
            product_data: {
              name,
              description: isPlan
                ? `${formatCents(product.cents)} a year`
                : "Credits never expire.",
            },
          },
        },
      ],
      // Fulfilment reads these back off the webhook. The userId matters most:
      // the webhook arrives with no session of its own.
      metadata: { userId, productId: product.id },
      ...(isPlan ? { subscription_data: { metadata: { userId, productId: product.id } } } : {}),
      success_url: `${appOrigin()}/?checkout=done`,
      cancel_url: `${appOrigin()}/?checkout=cancelled`,
    });

    return { url: session.url };
  });
}
