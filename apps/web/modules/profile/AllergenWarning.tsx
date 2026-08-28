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

  useEffect(() => {
    void api
      .dietaryProfile()
      .then((data) => setAllergens(data.allergens))
      .catch(() => undefined);
  }, []);

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
