import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CREDIT_PACKS,
  TIER_ALLOWANCE,
  costsCredit,
  creditBalance,
  creditMonth,
  describeCredits,
  formatPackPrice,
  nextResetISO,
  outOfCreditsMessage,
  packById,
  tierOr,
  type CreditUsage,
} from "../src/credits.js";

const usage = (over: Partial<CreditUsage> = {}): CreditUsage => ({
  tier: "plus",
  allowanceUsed: 0,
  purchased: 0,
  purchasedUsed: 0,
  ...over,
});

describe("costsCredit", () => {
  it("charges for the paths that actually call a model", () => {
    assert.equal(costsCredit("transcript-llm"), true);
    assert.equal(costsCredit("article-llm"), true);
    assert.equal(costsCredit("caption-llm"), true);
  });

  it("never charges for reading a page's own recipe data", () => {
    // schema.org costs nothing to serve, so billing for it would be inventing
    // a cost to charge for.
    assert.equal(costsCredit("schema-org"), false);
  });

  it("never charges for typing a recipe in by hand", () => {
    assert.equal(costsCredit("manual"), false);
  });
});

describe("creditBalance", () => {
  it("starts a month with the whole allowance", () => {
    const b = creditBalance(usage());
    assert.equal(b.allowance, TIER_ALLOWANCE.plus);
    assert.equal(b.total, TIER_ALLOWANCE.plus);
    assert.equal(b.canSpend, true);
    assert.equal(b.nextFrom, "allowance");
  });

  it("spends the perishable pool first", () => {
    // The allowance expires at month end and purchased credits never do, so
    // draining the allowance first is what loses the customer the least.
    const b = creditBalance(usage({ allowanceUsed: 10, purchased: 25 }));
    assert.equal(b.nextFrom, "allowance");
    assert.equal(b.allowanceLeft, 15);
    assert.equal(b.purchasedLeft, 25);
    assert.equal(b.total, 40);
  });

  it("falls through to purchased credits once the allowance is gone", () => {
    const b = creditBalance(usage({ allowanceUsed: 25, purchased: 25, purchasedUsed: 5 }));
    assert.equal(b.allowanceLeft, 0);
    assert.equal(b.nextFrom, "purchased");
    assert.equal(b.total, 20);
    assert.equal(b.canSpend, true);
  });

  it("stops when both pools are empty", () => {
    const b = creditBalance(usage({ allowanceUsed: 25, purchased: 10, purchasedUsed: 10 }));
    assert.equal(b.total, 0);
    assert.equal(b.canSpend, false);
    assert.equal(b.nextFrom, null);
  });

  it("reads a downgrade as none left, never as a negative", () => {
    // Someone on Pro who used 40, then dropped to a 25-credit plan, has used
    // more than they now get. That should say zero, not -15.
    const b = creditBalance(usage({ tier: "plus", allowanceUsed: 40 }));
    assert.equal(b.allowanceLeft, 0);
    assert.equal(b.total, 0);
    assert.equal(b.canSpend, false);
  });

  it("never reports more purchased credits than were bought", () => {
    const b = creditBalance(usage({ purchased: 5, purchasedUsed: 9 }));
    assert.equal(b.purchasedLeft, 0);
  });

  it("gives the free tier a real allowance, so the trick can be tried", () => {
    const b = creditBalance(usage({ tier: "free" }));
    assert.equal(b.total, TIER_ALLOWANCE.free);
    assert.ok(b.total > 0, "a free tier with no credits can never demonstrate the feature");
  });
});

describe("creditMonth", () => {
  it("is a sortable YYYY-MM string", () => {
    assert.equal(creditMonth(new Date("2026-08-26T12:00:00Z")), "2026-08");
    assert.equal(creditMonth(new Date("2026-01-01T00:00:00Z")), "2026-01");
  });

  it("uses UTC, so an allowance resets at one instant worldwide", () => {
    // 23:00 on the 31st in UTC is already September for anyone east of London.
    // The month a spend lands in must not depend on where the cook is standing.
    assert.equal(creditMonth(new Date("2026-08-31T23:59:59Z")), "2026-08");
    assert.equal(creditMonth(new Date("2026-09-01T00:00:00Z")), "2026-09");
  });
});

describe("nextResetISO", () => {
  it("is the first of next month", () => {
    assert.equal(nextResetISO(new Date("2026-08-26T12:00:00Z")), "2026-09-01");
  });

  it("rolls the year over in December", () => {
    assert.equal(nextResetISO(new Date("2026-12-14T12:00:00Z")), "2027-01-01");
  });

  it("is right on the last instant of a month", () => {
    assert.equal(nextResetISO(new Date("2026-01-31T23:59:59Z")), "2026-02-01");
  });
});

describe("describeCredits", () => {
  it("leads with the number, since that's the thing being asked", () => {
    assert.match(describeCredits(creditBalance(usage())), /^25 AI imports left/);
  });

  it("says 'import' for exactly one", () => {
    assert.match(describeCredits(creditBalance(usage({ allowanceUsed: 24 }))), /^1 AI import left/);
  });

  it("splits the two pools when both have something in them", () => {
    const text = describeCredits(creditBalance(usage({ allowanceUsed: 20, purchased: 30 })));
    assert.match(text, /35 AI imports left/);
    assert.match(text, /5 this month, 30 topped up/);
  });

  it("says so plainly at zero", () => {
    const b = creditBalance(usage({ allowanceUsed: 25 }));
    assert.equal(describeCredits(b), "No AI imports left this month");
  });
});

describe("outOfCreditsMessage", () => {
  it("points a free user at upgrading, not at topping up", () => {
    const text = outOfCreditsMessage(creditBalance(usage({ tier: "free", allowanceUsed: 3 })), "2026-09-01");
    assert.doesNotMatch(text, /top up/i);
    assert.match(text, /2026-09-01/);
  });

  it("points a paying user at topping up, never at upgrading", () => {
    // Telling someone to upgrade when they already have is how you lose them.
    const text = outOfCreditsMessage(creditBalance(usage({ tier: "pro", allowanceUsed: 50 })), "2026-09-01");
    assert.match(text, /top up/i);
    assert.doesNotMatch(text, /upgrade/i);
  });

  it("always mentions that structured-data imports stay free", () => {
    for (const tier of ["free", "plus", "pro"] as const) {
      const text = outOfCreditsMessage(creditBalance(usage({ tier, allowanceUsed: 999 })), "2026-09-01");
      assert.match(text, /free/i, `${tier} should still be told what it can do`);
    }
  });
});

describe("tierOr", () => {
  it("falls back to free rather than throwing on nonsense", () => {
    assert.equal(tierOr("nope"), "free");
    assert.equal(tierOr(null), "free");
    assert.equal(tierOr(undefined), "free");
  });

  it("passes real tiers through", () => {
    assert.equal(tierOr("pro"), "pro");
  });
});

describe("credit packs", () => {
  it("prices every pack in whole cents", () => {
    for (const pack of CREDIT_PACKS) {
      assert.equal(pack.cents, Math.round(pack.cents), `${pack.id} must be whole cents`);
      assert.ok(pack.credits > 0);
    }
  });

  it("costs at least four cents a credit, well above what an import costs to serve", () => {
    // Measured cost is $0.077 on the current pipeline. A pack cheaper than that
    // would be selling imports at a loss.
    for (const pack of CREDIT_PACKS) {
      const perCredit = pack.cents / pack.credits;
      assert.ok(perCredit >= 4, `${pack.id} is ${perCredit}c per credit — too close to cost`);
    }
  });

  it("makes the bigger pack better value, or there's no reason to buy it", () => {
    const sorted = [...CREDIT_PACKS].sort((a, b) => a.credits - b.credits);
    for (let i = 1; i < sorted.length; i++) {
      const cheaper = sorted[i - 1]!.cents / sorted[i - 1]!.credits;
      const bigger = sorted[i]!.cents / sorted[i]!.credits;
      assert.ok(bigger <= cheaper, `${sorted[i]!.id} costs more per credit than a smaller pack`);
    }
  });

  it("looks up by id and formats as dollars", () => {
    assert.equal(packById("pack-25")?.credits, 25);
    assert.equal(packById("nope"), undefined);
    assert.equal(formatPackPrice({ id: "x", credits: 25, cents: 299 }), "$2.99");
  });
});
