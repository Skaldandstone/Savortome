/**
 * Checks purchase fulfilment against a real database.
 *
 *   pnpm check:billing
 *
 * Every assertion here is about the same worry: Stripe retries a webhook until
 * it gets a 2xx, so the same event arrives more than once in normal operation.
 * Fulfilment that isn't idempotent hands out free money. This proves it is —
 * against real Postgres, where the unique constraints doing the work actually
 * live, rather than against a mock that would agree with anything.
 *
 * No Stripe account needed. The events are synthesised; what's being tested is
 * what this app does with one, not that Stripe can send it.
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { inArray } from "drizzle-orm";
import {
  TIER_ALLOWANCE,
  fulfilmentFor,
  planProductId,
  productById,
  tierForSubscriptionStatus,
} from "@seconds/core";
import * as schema from "../src/schema.js";
import {
  applyPurchase,
  applySubscriptionTier,
  claimStripeEvent,
  linkStripeCustomer,
  purchaseHistory,
  stripeEventSeen,
  userForSubscription,
} from "../src/queries/billing.js";
import { creditsFor } from "../src/queries/credits.js";

const url =
  process.env.DATABASE_URL ??
  /DATABASE_URL=(.+)/.exec(readFileSync("../../apps/web/.env.local", "utf8"))![1]!.trim();
const db = drizzle(neon(url), { schema });

let failures = 0;
const expect = (label: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${label}` +
      (ok ? "" : `\n        got ${JSON.stringify(actual)} want ${JSON.stringify(expected)}`),
  );
};

// --- fixture ----------------------------------------------------------------
const HANDLES = ["bl-buyer", "bl-other"];
const EVENTS = ["evt_test_1", "evt_test_2", "evt_test_3"];

async function makeUser(handle: string): Promise<string> {
  const [row] = await db
    .insert(schema.users)
    .values({ email: `${handle}@localhost`, handle, displayName: handle.slice(3) })
    .onConflictDoUpdate({
      target: schema.users.email,
      set: { handle, tier: "free", creditsPurchased: 0, stripeCustomerId: null, stripeSubscriptionId: null },
    })
    .returning({ id: schema.users.id });
  return row!.id;
}

const [buyer, other] = (await Promise.all(HANDLES.map(makeUser))) as [string, string];
await db.delete(schema.creditPurchases).where(inArray(schema.creditPurchases.userId, [buyer, other]));
await db.delete(schema.creditSpends).where(inArray(schema.creditSpends.userId, [buyer, other]));
await db.delete(schema.stripeEvents).where(inArray(schema.stripeEvents.id, EVENTS));

// --- claiming an event ------------------------------------------------------
expect("a new event can be claimed", await claimStripeEvent(db, EVENTS[0]!, "checkout.session.completed"), true);
expect("...and the same one can't be claimed twice", await claimStripeEvent(db, EVENTS[0]!, "checkout.session.completed"), false);
expect("...and it's recorded as seen", await stripeEventSeen(db, EVENTS[0]!), true);
expect("an unrelated event is not seen", await stripeEventSeen(db, "evt_never"), false);

// Two deliveries arriving together: exactly one may win.
const raced = await Promise.all([
  claimStripeEvent(db, "evt_race", "checkout.session.completed"),
  claimStripeEvent(db, "evt_race", "checkout.session.completed"),
  claimStripeEvent(db, "evt_race", "checkout.session.completed"),
]);
expect("concurrent deliveries of one event: exactly one wins", raced.filter(Boolean).length, 1);
await db.delete(schema.stripeEvents).where(inArray(schema.stripeEvents.id, ["evt_race"]));

// --- buying a credit pack ---------------------------------------------------
const pack = productById("pack-100")!;
const before = await creditsFor(db, buyer);
const afterBuy = await applyPurchase(
  db,
  { userId: buyer, productId: pack.id, cents: pack.cents, credits: pack.credits, tier: null, stripeSessionId: "cs_test_1" },
  fulfilmentFor(pack),
);
expect("buying a pack grants its credits", afterBuy?.purchasedLeft, pack.credits);
expect("...on top of the monthly allowance", afterBuy?.total, before.allowanceLeft + pack.credits);
expect("...and doesn't change the tier", afterBuy?.tier, "free");

// The same session, delivered again.
const replay = await applyPurchase(
  db,
  { userId: buyer, productId: pack.id, cents: pack.cents, credits: pack.credits, tier: null, stripeSessionId: "cs_test_1" },
  fulfilmentFor(pack),
);
expect("replaying the same purchase does nothing", replay, null);
expect(
  "...and grants no second helping of credits",
  (await creditsFor(db, buyer)).purchasedLeft,
  pack.credits,
);
expect("...leaving one purchase on the record", (await purchaseHistory(db, buyer)).length, 1);

// A different session for the same product is a real second purchase.
await applyPurchase(
  db,
  { userId: buyer, productId: pack.id, cents: pack.cents, credits: pack.credits, tier: null, stripeSessionId: "cs_test_2" },
  fulfilmentFor(pack),
);
expect(
  "a genuinely new purchase does grant again",
  (await creditsFor(db, buyer)).purchasedLeft,
  pack.credits * 2,
);

// --- subscribing ------------------------------------------------------------
const plan = productById(planProductId("pro"))!;
const subscribed = await applyPurchase(
  db,
  { userId: other, productId: plan.id, cents: plan.cents, credits: 0, tier: "pro", stripeSessionId: "cs_test_sub" },
  fulfilmentFor(plan),
);
expect("subscribing moves the tier", subscribed?.tier, "pro");
expect("...granting the bigger allowance", subscribed?.allowance, TIER_ALLOWANCE.pro);
expect("...and no lump of purchased credits", subscribed?.purchasedLeft, 0);

// --- the subscription lifecycle ---------------------------------------------
await linkStripeCustomer(db, other, "cus_test", "sub_test");
expect("a subscription can be traced back to its account", await userForSubscription(db, "sub_test"), other);
expect(
  "...or via the customer when the subscription isn't linked yet",
  await userForSubscription(db, "sub_unknown", "cus_test"),
  other,
);
expect("an unknown subscription resolves to nobody", await userForSubscription(db, "sub_nope", null), null);

const pastDue = await applySubscriptionTier(db, other, tierForSubscriptionStatus("past_due", "pro"), "sub_test");
expect("a failed payment keeps the plan for now", pastDue.tier, "pro");

const cancelled = await applySubscriptionTier(db, other, tierForSubscriptionStatus("canceled", "pro"), "sub_test");
expect("cancelling drops to free", cancelled.tier, "free");
expect("...and the allowance shrinks with it", cancelled.allowance, TIER_ALLOWANCE.free);
expect(
  "...and the dead subscription is unlinked",
  await userForSubscription(db, "sub_test", null),
  null,
);

// --- credits outlive the plan ------------------------------------------------
const buyerAfter = await creditsFor(db, buyer);
expect(
  "purchased credits survive everything, because they were paid for",
  buyerAfter.purchasedLeft,
  pack.credits * 2,
);

// --- surviving a partial failure ---------------------------------------------
// The scenario the fulfilledAt column exists for: the purchase row lands, but
// the process dies before the grant runs — a dropped connection, a killed
// container. A naive retry would see the row, assume "already done," and
// leave the customer with nothing for a payment that's on the books.
await db
  .insert(schema.creditPurchases)
  .values({
    userId: buyer,
    productId: pack.id,
    cents: pack.cents,
    credits: pack.credits,
    stripeSessionId: "cs_test_stranded",
    fulfilledAt: null,
  });
const strandedBefore = await creditsFor(db, buyer);
const recovered = await applyPurchase(
  db,
  { userId: buyer, productId: pack.id, cents: pack.cents, credits: pack.credits, tier: null, stripeSessionId: "cs_test_stranded" },
  fulfilmentFor(pack),
);
expect(
  "a purchase stranded before fulfilment is completed on the next attempt",
  recovered?.purchasedLeft,
  strandedBefore.purchasedLeft + pack.credits,
);

// Once fulfilled, a further retry of the same session is a true duplicate.
const strandedReplay = await applyPurchase(
  db,
  { userId: buyer, productId: pack.id, cents: pack.cents, credits: pack.credits, tier: null, stripeSessionId: "cs_test_stranded" },
  fulfilmentFor(pack),
);
expect("...and a later retry of the now-fulfilled row grants nothing more", strandedReplay, null);

// --- cleanup ----------------------------------------------------------------
await db.delete(schema.creditPurchases).where(inArray(schema.creditPurchases.userId, [buyer, other]));
await db.delete(schema.creditSpends).where(inArray(schema.creditSpends.userId, [buyer, other]));
await db.delete(schema.stripeEvents).where(inArray(schema.stripeEvents.id, EVENTS));
await db.delete(schema.users).where(inArray(schema.users.handle, HANDLES));

console.log(failures === 0 ? "\nAll good." : `\n${failures} failed.`);
process.exit(failures === 0 ? 0 : 1);
