import { formatMinutes, type Recipe } from "@nomnom/core/format";
import styles from "./RecipeFacts.module.css";

/** The at-a-glance strip: how long, how many, what kind. */
export function RecipeFacts({ recipe }: { recipe: Recipe }) {
  const facts: [string, string][] = [];

  if (recipe.servingsNote && !recipe.servings) facts.push(["Yield", recipe.servingsNote]);
  const prep = formatMinutes(recipe.prepMinutes);
  const cook = formatMinutes(recipe.cookMinutes);
  const total = formatMinutes(recipe.totalMinutes);
  if (prep) facts.push(["Prep", prep]);
  if (cook) facts.push(["Cook", cook]);
  if (total) facts.push(["Total", total]);
  if (recipe.cuisine) facts.push(["Cuisine", recipe.cuisine]);
  if (recipe.difficulty) facts.push(["Effort", recipe.difficulty]);

  if (facts.length === 0) return null;

  return (
    <dl className={styles.facts}>
      {facts.map(([label, value]) => (
        <div key={label}>
          <dt className={styles.label}>{label}</dt>
          <dd className={styles.value}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <ul className={styles.tags}>
      {tags.map((tag) => (
        <li key={tag}>{tag}</li>
      ))}
    </ul>
  );
}
