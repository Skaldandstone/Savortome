"use client";

import { useEffect, useState } from "react";
import {
  ALLERGEN_DISCLAIMER,
  ALLERGEN_LABEL,
  flagsForRecipe,
  type Allergen,
  type AllergenFlag,
} from "@seconds/core/format";
import { api } from "@/lib/client";
import { actionFailure, type ActionFailure } from "@/lib/action-failure";
import { Button } from "@/ui";
import styles from "./profile.module.css";

/**
 * A heads-up, not a clearance. Checks this recipe's ingredients against
 * *your own* flagged allergens — whoever's signed in and looking at the
 * card, not whoever owns it — so it works the same on your own recipe and on
 * a friend's shared one.
 */
export function AllergenWarning({
  ingredients,
}: {
  ingredients: readonly { canonicalItem: string; optional: boolean }[];
}) {
  const [allergens, setAllergens] = useState<Allergen[]>([]);
  const [loadState, setLoadState] = useState<"checking" | "ready" | "failed">("checking");
  const [loadFailure, setLoadFailure] = useState<ActionFailure | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadState("checking");
    setLoadFailure(null);
    void api.dietaryProfile().then((data) => {
      if (cancelled) return;
      setAllergens(data.allergens);
      setLoadState("ready");
    }).catch((error) => {
      if (cancelled) return;
      setAllergens([]);
      setLoadFailure(actionFailure(error, "Your saved allergen flags could not be checked."));
      setLoadState("failed");
    });
    return () => { cancelled = true; };
  }, [attempt]);

  if (loadState === "checking") {
    return <p className={styles.checkState} role="status">Checking saved allergen flags…</p>;
  }

  if (loadState === "failed") {
    return (
      <div className={styles.warning} role="alert" data-print="hide">
        <div>
          <strong>Saved allergen check unavailable</strong>
          <span className={styles.warningNote}>
            {loadFailure?.signInRequired
              ? "Sign in again, then retry the check. No saved-allergen comparison has been made."
              : "We could not compare this recipe with your saved flags. Treat every ingredient as unchecked."}
          </span>
          <Button type="button" variant="ghost" onClick={() => setAttempt((current) => current + 1)}>
            Try allergen check again
          </Button>
        </div>
      </div>
    );
  }

  const flags: AllergenFlag[] = flagsForRecipe(ingredients, allergens);
  if (flags.length === 0) return null;

  const byAllergen = new Map<Allergen, string[]>();
  for (const flag of flags) {
    const list = byAllergen.get(flag.allergen) ?? [];
    list.push(flag.optional ? `${flag.canonicalItem} (optional)` : flag.canonicalItem);
    byAllergen.set(flag.allergen, list);
  }

  return (
    <div className={styles.warning} role="alert" data-print="hide">
      <div>
        <strong>May contain {[...byAllergen.keys()].map((a) => ALLERGEN_LABEL[a]).join(", ")}</strong>
        <ul className={styles.warningList}>
          {[...byAllergen.entries()].map(([allergen, items]) => (
            <li key={allergen}>
              {ALLERGEN_LABEL[allergen]}: {items.join(", ")}
            </li>
          ))}
        </ul>
        <span className={styles.warningNote}>{ALLERGEN_DISCLAIMER}</span>
      </div>
    </div>
  );
}
