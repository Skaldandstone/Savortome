"use client";

import { useEffect, useState } from "react";
import {
  CREDIT_PACKS,
  describeCredits,
  formatPackPrice,
  type CreditBalance,
  type CreditPack,
} from "@seconds/core/format";
import styles from "./import.module.css";

/**
 * How many AI imports are left.
 *
 * Shown before the paste box rather than after a refusal, because a limit you
 * discover by hitting it feels like a trap and one you can see is just a
 * number. Says plainly what doesn't count, since "unlimited from most recipe
 * sites" is the part people won't guess.
 */
export function CreditMeter({ balance, resetsOn }: { balance: CreditBalance; resetsOn: string }) {
  const [packs, setPacks] = useState<CreditPack[]>(CREDIT_PACKS);

  useEffect(() => {
    // Prices come from the server so a client cached mid-change can't offer a
    // pack at yesterday's price.
    fetch("/api/credits")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.packs && setPacks(d.packs))
      .catch(() => undefined);
  }, []);

  const empty = balance.total === 0;

  return (
    <div className={styles.meter} data-empty={empty}>
      <p className={styles.meterCount}>
        {describeCredits(balance)}
        {balance.allowanceLeft > 0 || empty ? (
          <span className={styles.meterReset}> · resets {resetsOn}</span>
        ) : null}
      </p>
      <p className={styles.meterNote}>
        Only videos, social posts and blogs without recipe data use a credit. Most recipe
        sites publish their own, and those imports are always free.
      </p>
      {empty ? (
        <div className={styles.meterPacks}>
          {packs.map((pack) => (
            <button key={pack.id} type="button" className={styles.pack} disabled>
              {pack.credits} credits · {formatPackPrice(pack)}
            </button>
          ))}
          <span className={styles.meterSoon}>Top-ups aren't wired to payments yet</span>
        </div>
      ) : null}
    </div>
  );
}
