import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HANDLED_EVENTS,
  PLAN_PRICES,
  formatCents,
  fulfilmentFor,
  isHandledEvent,
  isPayableTier,
  planPriceFor,
  planProductId,
  productById,
  products,
  tierForSubscriptionStatus,
} from "../src/billing.js";
import { CREDIT_PACKS, TIER_ALLOWANCE } from "../src/credits.js";

describe("products", () => {
  it("offers every credit pack and every paid plan", () => {
    const all = products();
    assert.equal(all.filter((p) => p.kind === "pack").length, CREDIT_PACKS.length);
    assert.equal(all.filter((p) => p.kind === "plan").length, PLAN_PRICES.length);
  });

  it("never offers the free tier as something to buy", () => {
    assert.equal(
      products().some((p) => p.tier === ("free" as never)),
      false,
    );
  });

  it("gives every product a unique id", () => {
    const ids = products().map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("keeps pack ids and plan ids from colliding", () => {
    // A typo in a query string shouldn't be able to turn a pack into a plan.
    for (const product of products()) {
      const prefix = product.kind === "pack" ? "pack-" : "plan-";
      assert.ok(product.id.startsWith(prefix), `${product.id} has the wrong prefix`);
    }
  });

  it("prices everything in whole cents", () => {
    for (const product of products()) {
      assert.equal(product.cents, Math.round(product.cents), `${product.id} isn't whole cents`);
      assert.ok(product.cents > 0, `${product.id} is free — that isn't a purchase`);
    }
  });
});

describe("productById", () => {
  it("finds a real product", () => {
    assert.equal(productById("pack-25")?.credits, 25);
    assert.equal(productById(planProductId("pro"))?.tier, "pro");
  });

  it("returns undefined for anything invented", () => {
    // A hand-edited checkout URL is a 400, not a crash.
    assert.equal(productById("pack-1000000"), undefined);
    assert.equal(productById("plan-free"), undefined);
    assert.equal(productById(""), undefined);
    assert.equal(productById("../../etc/passwd"), undefined);
  });
});

describe("fulfilmentFor", () => {
  it("grants credits for a pack and moves no tier", () => {
    const f = fulfilmentFor(productById("pack-100")!);
    assert.equal(f.grantCredits, 100);
    assert.equal(f.setTier, null);
  });

  it("moves the tier for a plan and grants no credits", () => {
    // A plan changes the monthly allowance; it doesn't hand over a lump sum.
    const f = fulfilmentFor(productById(planProductId("plus"))!);
    assert.equal(f.grantCredits, null);
    assert.equal(f.setTier, "plus");
  });

  it("never does both", () => {
    for (const product of products()) {
      const f = fulfilmentFor(product);
      assert.ok(
        !(f.grantCredits !== null && f.setTier !== null),
        `${product.id} both grants credits and sets a tier`,
      );
    }
  });

  it("always does something", () => {
    for (const product of products()) {
      const f = fulfilmentFor(product);
      assert.ok(
        f.grantCredits !== null || f.setTier !== null,
        `${product.id} takes money and changes nothing`,
      );
    }
  });
});

describe("tierForSubscriptionStatus", () => {
  it("keeps the plan while it's active or trialing", () => {
    assert.equal(tierForSubscriptionStatus("active", "pro"), "pro");
    assert.equal(tierForSubscriptionStatus("trialing", "pro"), "pro");
  });

  it("keeps the plan through a failed payment", () => {
    // A card that failed at 3am usually succeeds on retry. Removing someone's
    // features over it costs more goodwill than the access costs money.
    assert.equal(tierForSubscriptionStatus("past_due", "plus"), "plus");
  });

  it("drops to free once it's genuinely over", () => {
    assert.equal(tierForSubscriptionStatus("canceled", "pro"), "free");
    assert.equal(tierForSubscriptionStatus("unpaid", "pro"), "free");
    assert.equal(tierForSubscriptionStatus("incomplete_expired", "pro"), "free");
  });

  it("treats an unrecognised status as over rather than as paid", () => {
    // Failing closed on money: an unknown state should not confer a paid plan.
    assert.equal(tierForSubscriptionStatus("something_new", "pro"), "free");
  });
});

describe("isHandledEvent", () => {
  it("recognises the events fulfilment acts on", () => {
    for (const type of HANDLED_EVENTS) assert.equal(isHandledEvent(type), true);
  });

  it("ignores everything else", () => {
    // Stripe sends a great many events; a 200 saying "understood, did nothing"
    // is the right answer to nearly all of them.
    assert.equal(isHandledEvent("invoice.created"), false);
    assert.equal(isHandledEvent("payment_intent.succeeded"), false);
    assert.equal(isHandledEvent(""), false);
  });
});

describe("isPayableTier", () => {
  it("accepts the tiers that can be bought", () => {
    assert.equal(isPayableTier("plus"), true);
    assert.equal(isPayableTier("pro"), true);
  });

  it("rejects free, and anything that isn't a tier", () => {
    // Metadata arriving from outside must not be able to name the free tier as
    // a purchase, or an unknown string as a plan.
    assert.equal(isPayableTier("free"), false);
    assert.equal(isPayableTier("admin"), false);
    assert.equal(isPayableTier(null), false);
    assert.equal(isPayableTier(42), false);
  });
});

describe("plan prices", () => {
  it("prices a bigger allowance higher", () => {
    const sorted = [...PLAN_PRICES].sort((a, b) => TIER_ALLOWANCE[a.tier] - TIER_ALLOWANCE[b.tier]);
    for (let i = 1; i < sorted.length; i++) {
      assert.ok(
        sorted[i]!.cents > sorted[i - 1]!.cents,
        `${sorted[i]!.tier} gives more credits than ${sorted[i - 1]!.tier} but costs no more`,
      );
    }
  });

  it("covers its own worst case at $0.077 an import", () => {
    // The measured cost of one AI import on the current pipeline. A plan whose
    // fully-burned allowance costs more than the plan earns is a plan that
    // loses money on its best customers.
    for (const plan of PLAN_PRICES) {
      const worstCase = TIER_ALLOWANCE[plan.tier] * 12 * 0.077;
      const net = (plan.cents / 100) * 0.97; // web checkout, ~3%
      assert.ok(
        net > worstCase,
        `${plan.tier}: worst case $${worstCase.toFixed(2)} exceeds net $${net.toFixed(2)}`,
      );
    }
  });

  it("has a price for every paid tier and none for free", () => {
    assert.ok(planPriceFor("plus"));
    assert.ok(planPriceFor("pro"));
    assert.equal(planPriceFor("free"), undefined);
  });
});

describe("formatCents", () => {
  it("shows whole cents as dollars", () => {
    assert.equal(formatCents(2999), "$29.99");
    assert.equal(formatCents(1099), "$10.99");
    assert.equal(formatCents(300), "$3.00");
  });
});
