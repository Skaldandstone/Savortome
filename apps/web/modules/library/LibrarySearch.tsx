import styles from "./library.module.css";

/**
 * Searching your own recipes.
 *
 * A plain GET form rather than client state, matching the shelf tabs beside
 * it: the result is a real URL, so it survives a refresh, can be sent to
 * someone, and needs no JavaScript to work at all.
 *
 * The shelf rides along in a hidden field so searching doesn't silently drop
 * the filter you were already looking at.
 */
export function LibrarySearch({
  query,
  shelfId,
  sort,
}: {
  query: string;
  shelfId?: string;
  sort?: string;
}) {
  return (
    <form className={styles.search} action="/" method="get" role="search">
      {shelfId ? <input type="hidden" name="shelf" value={shelfId} /> : null}
      {sort && sort !== "newest" ? <input type="hidden" name="sort" value={sort} /> : null}
      <input
        className={styles.searchInput}
        type="search"
        name="q"
        defaultValue={query}
        placeholder="Search your recipes — a name, a tag, an ingredient"
        aria-label="Search your recipes"
      />
      <button className={styles.searchButton} type="submit">
        Search
      </button>
      {query ? (
        <a className={styles.clear} href={clearHref(shelfId, sort)}>
          Clear
        </a>
      ) : null}
    </form>
  );
}

/** Clearing the search keeps the shelf and the order you were looking at. */
function clearHref(shelfId?: string, sort?: string): string {
  const params = new URLSearchParams();
  if (shelfId) params.set("shelf", shelfId);
  if (sort && sort !== "newest") params.set("sort", sort);
  const qs = params.toString();
  return qs ? `/?${qs}` : "/";
}
