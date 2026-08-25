import Link from "next/link";
import type { ShelfSummary } from "@nomnom/core/format";
import styles from "./library.module.css";

/**
 * Shelf tabs above the library. Plain links rather than client state, so a
 * filtered view is shareable and survives a refresh.
 */
export function ShelfFilter({
  shelves,
  activeShelfId,
}: {
  shelves: ShelfSummary[];
  activeShelfId?: string;
}) {
  if (shelves.length === 0) return null;

  return (
    <nav className={styles.filter} aria-label="Filter by shelf">
      <Link
        href="/"
        className={styles.tab}
        aria-current={activeShelfId ? undefined : "page"}
      >
        All
      </Link>
      {shelves.map((shelf) => (
        <Link
          key={shelf.id}
          href={`/?shelf=${shelf.id}`}
          className={styles.tab}
          aria-current={activeShelfId === shelf.id ? "page" : undefined}
        >
          {shelf.name}
          {shelf.recipeCount > 0 ? (
            <span className={styles.tabCount}>{shelf.recipeCount}</span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
