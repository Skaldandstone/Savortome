import Link from "next/link";
import type { ShelfSummary } from "@seconds/core/format";
import styles from "./library.module.css";

/**
 * Shelf tabs above the library. Plain links rather than client state, so a
 * filtered view is shareable and survives a refresh.
 */
export function ShelfFilter({
  shelves,
  activeShelfId,
  query = "",
  sort,
}: {
  shelves: ShelfSummary[];
  activeShelfId?: string;
  /** Carried through the tabs so switching shelf doesn't drop the search. */
  query?: string;
  /** Likewise the order. Omitted when it's the default. */
  sort?: string;
}) {
  if (shelves.length === 0) return null;

  const href = (shelfId?: string) => {
    const params = new URLSearchParams();
    if (shelfId) params.set("shelf", shelfId);
    if (query.trim()) params.set("q", query.trim());
    if (sort && sort !== "newest") params.set("sort", sort);
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  };

  return (
    <nav className={styles.filter} aria-label="Filter by shelf">
      <Link
        href={href()}
        className={styles.tab}
        aria-current={activeShelfId ? undefined : "page"}
      >
        All
      </Link>
      {shelves.map((shelf) => (
        <Link
          key={shelf.id}
          href={href(shelf.id)}
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
