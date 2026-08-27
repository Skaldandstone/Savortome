import Link from "next/link";
import { LIBRARY_SORTS, LIBRARY_SORT_LABEL, type LibrarySort } from "@seconds/core/format";
import styles from "./library.module.css";

/**
 * How the library is ordered.
 *
 * Links rather than a select, matching the shelf tabs and the search box: the
 * order is part of the URL, so it survives a refresh and can be sent to
 * someone. Every option carries the shelf and the search along with it — a
 * control that silently discards the other two would be worse than no control.
 */
export function LibrarySort({
  sort,
  shelfId,
  query,
}: {
  sort: LibrarySort;
  shelfId?: string;
  query: string;
}) {
  const href = (next: LibrarySort) => {
    const params = new URLSearchParams();
    if (shelfId) params.set("shelf", shelfId);
    if (query.trim()) params.set("q", query.trim());
    // "newest" is the default, so it doesn't need saying in the URL.
    if (next !== "newest") params.set("sort", next);
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
  };

  return (
    <nav className={styles.sort} aria-label="Sort recipes">
      <span className={styles.sortLabel}>Sort</span>
      {LIBRARY_SORTS.map((option) => (
        <Link
          key={option}
          href={href(option)}
          className={styles.sortOption}
          aria-current={sort === option ? "page" : undefined}
        >
          {LIBRARY_SORT_LABEL[option]}
        </Link>
      ))}
    </nav>
  );
}
