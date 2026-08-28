import Link from "next/link";
import { TEMPLATE_ROLES, TEMPLATE_ROLE_LABEL, type TemplateItem } from "@seconds/core/format";
import styles from "./templates.module.css";

/**
 * The dishes in a meal, main first, in the same fixed order everywhere.
 *
 * `linkBase` points each title at the right page for who's looking: your own
 * saved meal links to `/recipe` (your private, editable copy), a shared one
 * links to `/r` (the public page — the only one a stranger's copy is even
 * guaranteed to have).
 */
export function TemplateItems({
  items,
  linkBase,
}: {
  items: TemplateItem[];
  linkBase: "/recipe" | "/r";
}) {
  const ordered = [...items].sort(
    (a, b) => TEMPLATE_ROLES.indexOf(a.role) - TEMPLATE_ROLES.indexOf(b.role),
  );

  return (
    <ul className={styles.items}>
      {ordered.map((item) => (
        <li key={item.role} className={styles.item}>
          <span className={styles.role}>{TEMPLATE_ROLE_LABEL[item.role]}</span>
          <Link className={styles.itemTitle} href={`${linkBase}/${item.recipeId}`}>
            {item.title}
          </Link>
        </li>
      ))}
    </ul>
  );
}
