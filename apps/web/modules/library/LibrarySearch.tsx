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
export function LibrarySearch({ query, shelfId }: { query: string; shelfId?: string }) {
  return (
    <form className={styles.search} action="/" method="get" role="search">
      {shelfId ? <input type="hidden" name="shelf" value={shelfId} /> : null}
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
        <a className={styles.clear} href={shelfId ? `/?shelf=${shelfId}` : "/"}>
          Clear
        </a>
      ) : null}
    </form>
  );
}
