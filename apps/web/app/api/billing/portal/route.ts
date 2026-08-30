import { NextResponse } from "next/server";
import { BadRequestError, withUser } from "@/lib/api";
import { appOrigin, stripe, stripeConfigured } from "@/lib/stripe";

export const runtime = "nodejs";

/** Only the signed-in customer's own portal session may be opened. */
export async function POST() {
  const configuration = process.env.STRIPE_PORTAL_CONFIGURATION_ID;
  if (!stripeConfigured() || !configuration) {
    return NextResponse.json({ error: "Billing management isn't configured." }, { status: 501 });
  }
  return withUser(async (userId, database) => {
    const user = await database.query.users.findFirst({
      where: (u, { eq }) => eq(u.id, userId),
      columns: { stripeCustomerId: true },
    });
    if (!user?.stripeCustomerId) throw new BadRequestError("No billing account is linked yet.");
    const session = await stripe().billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      configuration,
      return_url: `${appOrigin()}/`,
    });
    return { url: session.url };
  });
}
