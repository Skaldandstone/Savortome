import { formatAmount, type Ingredient } from "@nomnom/core/format";
import { Button } from "@/ui";
import styles from "./IngredientList.module.css";

export function ServingScaler({
  servings,
  onIncrement,
  onDecrement,
}: {
  servings: number;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  return (
    <div className={styles.scaler}>
      <Button variant="ghost" type="button" onClick={onDecrement} aria-label="Fewer servings">
        −
      </Button>
      <span>
        {servings} {servings === 1 ? "serving" : "servings"}
      </span>
      <Button variant="ghost" type="button" onClick={onIncrement} aria-label="More servings">
        +
      </Button>
    </div>
  );
}

export function IngredientList({ ingredients }: { ingredients: Ingredient[] }) {
  let lastGroup: string | null = null;

  return (
    <ul className={styles.list}>
      {ingredients.map((ing, i) => {
        // Sub-recipe headings ("For the sauce") appear once, above their first item.
        const heading = ing.group && ing.group !== lastGroup ? ing.group : null;
        lastGroup = ing.group;

        return (
          <li key={`${ing.canonicalItem}-${i}`} className={styles.item}>
            {heading ? <span className={styles.groupHeading}>{heading}</span> : null}
            <span className={styles.amount}>{formatAmount(ing)}</span>
            <span>
              {ing.item}
              {ing.notes ? <span className={styles.note}>, {ing.notes}</span> : null}
              {ing.optional ? <span className={styles.note}> (optional)</span> : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
