"use client";

import { useState } from "react";
import {
  PLAN_PRICES,
  TIER_ALLOWANCE,
  TIER_LABEL,
  describeCredits,
  formatCents,
  formatPackPrice,
  planProductId,
  type CreditBalance,
  type CreditPack,
} from "@seconds/core/format";
import styles from "./import.module.css";

/**
 * How many AI imports are left, and how to get more.
 *
 * Shown before the paste box rather than after a refusal, because a limit you
 * discover by hitting it feels like a trap and one you can see is just a
 * number. Says plainly what doesn't count, since "unlimited from most recipe
 * sites" is the part nobody would guess.
 *
 * Tier names are shown with their credit counts throughout. The names are
 * hobbit meals, which is charming but carries no inherent size ordering — the
 * number does that work, so the two travel together.
 */
export function CreditMeter({
  balance,
  resetsOn,
  packs,
}: {
  balance: CreditBalance;
  resetsOn: string;
  /**
   * Prices come from the server, so a client cached across a price change
   * can't offer a pack at yesterday's rate. Passed down rather than fetched
   * here — the parent already asked the same endpoint for the same payload.
   */
  packs: CreditPack[];
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const buy = async (productId: string) => {
    setBusy(productId);
    setProblem(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      const data = await response.json();

      if (response.ok && data.url) {
        // Stripe's own page. Nothing sensitive is ever typed into this app.
        window.location.href = data.url;
        return;
      }
      // A 501 means payments aren't configured, which is a fact about the
      // deployment rather than a failure the person reading it caused.
      setProblem(data.error ?? "Couldn't start checkout.");
    } catch {
      setProblem("Couldn't reach checkout. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  const empty = balance.total === 0;
  const upgrades = PLAN_PRICES.filter((plan) => TIER_ALLOWANCE[plan.tier] > balance.allowance);

  return (
    <div className={styles.meter} data-empty={empty}>
      <p className={styles.meterCount}>
        {describeCredits(balance)}
        <span className={styles.meterReset}>
          {" "}
          · {TIER_LABEL[balance.tier]}, {balance.allowance} a month
          {balance.allowanceLeft > 0 || empty ? ` · resets ${resetsOn}` : ""}
        </span>
      </p>
      <p className={styles.meterNote}>
        Only videos, social posts and blogs without recipe data use a credit. Most recipe
        sites publish their own, and those imports are always free.
      </p>

      {empty ? (
        <div className={styles.meterPacks}>
          {upgrades.map((plan) => (
            <button
              key={plan.tier}
              type="button"
              className={styles.pack}
              data-primary="true"
              disabled={busy !== null}
              onClick={() => void buy(planProductId(plan.tier))}
            >
              {TIER_LABEL[plan.tier]} · {TIER_ALLOWANCE[plan.tier]}/mo ·{" "}
              {formatCents(plan.cents)}/yr
            </button>
          ))}
          {packs.map((pack) => (
            <button
              key={pack.id}
              type="button"
              className={styles.pack}
              disabled={busy !== null}
              onClick={() => void buy(pack.id)}
            >
              {pack.credits} credits · {formatPackPrice(pack)}
            </button>
          ))}
          {problem ? <span className={styles.meterProblem} role="alert">{problem}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
