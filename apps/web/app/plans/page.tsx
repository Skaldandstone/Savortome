import { billingAvailability, products, tierOr } from "@seconds/core";
import { creditsFor, db } from "@seconds/db";
import { PlanTable } from "@/modules/plans";
import { KitchenPageHeading } from "@/modules/woodland/KitchenPageHeading";
import { Panel, PanelHeader } from "@/ui";
import { viewerId, databaseConfigured } from "@/lib/session";
import { priceForProduct, stripeConfigured, webhookConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  // Signed out still sees the plans — they're the argument for signing up, so
  // hiding them behind an account would be exactly backwards.
  let tier = tierOr(null);
  let signedIn = false;
  let hasCustomer = false;
  const databaseReady = databaseConfigured();
  if (databaseReady) {
    const database = db();
    const userId = await viewerId(database);
    if (userId) {
      const [balance, user] = await Promise.all([
        creditsFor(database, userId),
        database.query.users.findFirst({
          where: (u, { eq }) => eq(u.id, userId),
          columns: { stripeCustomerId: true },
        }),
      ]);
      tier = balance.tier;
      signedIn = true;
      hasCustomer = Boolean(user?.stripeCustomerId);
    }
  }
  const availability = billingAvailability({
    checkoutEnabled: process.env.STRIPE_CHECKOUT_ENABLED === "true",
    signedIn,
    databaseReady,
    stripeReady: stripeConfigured(),
    webhookReady: webhookConfigured(),
    pricedProducts: products().filter((product) => Boolean(priceForProduct(product.id))).map((product) => product.id),
    hasCustomer,
    portalConfigured: Boolean(process.env.STRIPE_PORTAL_CONFIGURATION_ID),
  });

  return (
    <main className="woodland-workspace" data-kitchen-page="plans">
      <KitchenPageHeading
        title="Plans for your kitchen"
        description="See what is included, with paid imports kept clearly separate."
        icon="book"
      />
      <Panel>
        <PanelHeader
          title="Plans"
          hint="Everything except AI import is free, on every plan. Credits are for the one thing that costs money to run."
        />
      </Panel>
      <PlanTable current={tier} availability={availability} />
    </main>
  );
}
