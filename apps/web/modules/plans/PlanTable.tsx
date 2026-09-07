"use client";

import { useState } from "react";
import type { BillingAvailability } from "@seconds/core";
import {
  CREDIT_PACKS,
  PLAN_PRICES,
  TIERS,
  TIER_ALLOWANCE,
  TIER_LABEL,
  formatCents,
  formatPackPrice,
  planProductId,
  type Tier,
} from "@seconds/core/format";
import { Callout } from "@/ui";
import styles from "./plans.module.css";

/**
 * What the plans are, and what you're on.
 *
 * The free column is deliberately the longest. Almost everything in this app
 * costs nothing to serve, so almost everything is free, and saying so plainly
 * is a better argument for the paid tiers than hiding it would be — what's
 * being sold is the one expensive thing, not access to the app.
 */

/** Everything free, listed once. Repeating it per column would bury the difference. */
const ALWAYS_FREE = [
  "Unlimited recipes, written by hand or imported from any site that publishes its own recipe data",
  "Shelves, ratings and a cooked-it counter",
  "The week planner, and one shopping list built from it",
  "Shopping list sorted by supermarket aisle",
  "Cook mode with step timers that survive a locked phone",
  "Print, export to Markdown or text, and a JSON archive of everything",
  "Sharing, friends, and discovery",
  "Pantry search in plain language — what can I make?",
];

export function PlanTable({ current, availability }: { current: Tier; availability: BillingAvailability }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const manageBilling = async () => {
    if (!availability.portal) return;
    setBusy("portal");
    setProblem(null);
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const data = await response.json();
      if (response.ok && data.url) window.location.href = data.url;
      else setProblem(data.error ?? "Couldn't open billing management.");
    } catch {
      setProblem("Couldn't reach billing management. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const buy = async (productId: string) => {
    if (!availability.checkoutProducts.some((id) => id === productId)) return;
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
        window.location.href = data.url;
        return;
      }
      setProblem(data.error ?? "Couldn't start checkout.");
    } catch {
      setProblem("Couldn't reach checkout. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      {availability.checkoutNotice ? (
        <p id="billing-availability" className={styles.availability} role="status">
          {availability.checkoutNotice}
        </p>
      ) : null}
      <div className={styles.grid}>
        {TIERS.map((tier) => {
          const price = PLAN_PRICES.find((p) => p.tier === tier);
          const isCurrent = tier === current;

          return (
            <section key={tier} className={styles.tier} data-current={isCurrent}>
              {isCurrent ? <span className={styles.badge}>Your plan</span> : null}

              <h2 className={styles.name}>{TIER_LABEL[tier]}</h2>
              <p className={styles.price}>
                {price ? formatCents(price.cents) : "Free"}
                {price ? <span className={styles.per}>/year</span> : null}
              </p>

              <p className={styles.allowance}>
                <strong>{TIER_ALLOWANCE[tier]}</strong> AI imports a month
              </p>
              <p className={styles.allowanceNote}>
                Videos, social posts, and blogs without recipe data
              </p>

              {tier === "pro" ? (
                <p className={styles.soon}>Household sharing, when it's built</p>
              ) : null}

              {price && !isCurrent ? (
                <button
                  type="button"
                  className={styles.buy}
                  disabled={busy !== null || !availability.checkoutProducts.includes(planProductId(price.tier))}
                  aria-describedby={availability.checkoutNotice ? "billing-availability" : undefined}
                  onClick={() => void buy(planProductId(price.tier))}
                >
                  {busy === planProductId(price.tier) ? "Opening…" : `Choose ${TIER_LABEL[tier]}`}
                </button>
              ) : null}
            </section>
          );
        })}
      </div>

      {availability.portal ? (
        <button type="button" className={styles.buy} disabled={busy !== null} onClick={() => void manageBilling()}>
          {busy === "portal" ? "Opening billing..." : "Manage billing"}
        </button>
      ) : null}

      {problem ? (
        <Callout tone="warn" title="Billing isn't available" role="status">
          {problem}
        </Callout>
      ) : null}

      <section className={styles.free}>
        <h3 className={styles.freeTitle}>On every plan, including the free one</h3>
        <ul className={styles.freeList}>
          {ALWAYS_FREE.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className={styles.freeNote}>
          Only one thing in this app costs anything to run: asking a model to read a video
          or an unstructured page. That's what a credit is for, and it's the only thing
          metered. A recipe site that publishes its own data is read directly, so those
          imports never use one.
        </p>
      </section>

      <section className={styles.packs}>
        <h3 className={styles.freeTitle}>Need more this month?</h3>
        <p className={styles.freeNote}>
          Top-ups are one-off. Unlike the monthly allowance, purchased credits never expire.
        </p>
        <div className={styles.packRow}>
          {CREDIT_PACKS.map((pack) => (
            <button
              key={pack.id}
              type="button"
              className={styles.pack}
              disabled={busy !== null || !availability.checkoutProducts.some((id) => id === pack.id)}
              aria-describedby={availability.checkoutNotice ? "billing-availability" : undefined}
              onClick={() => void buy(pack.id)}
            >
              {pack.credits} credits · {formatPackPrice(pack)}
            </button>
          ))}
        </div>
      </section>
    </>
  );
}
