import styles from "./library.module.css";

/**
 * Leaving with the whole collection.
 *
 * A plain link rather than a button: the route answers with a
 * content-disposition header, so the browser saves the file without any
 * JavaScript being involved at all. That also means it still works with a
 * middle click, a right-click "save as", or a script pointed at the URL.
 *
 * The count is the whole library rather than what's on screen, because that's
 * what the file will contain — the list above is filtered and paged.
 */
export function LibraryExport({ total }: { total: number }) {
  if (total === 0) return null;

  return (
    <p className={styles.export} data-print="hide">
      <a href="/api/export" download>
        Download all {total} {total === 1 ? "recipe" : "recipes"}
      </a>{" "}
      as a JSON file — every recipe in full, yours to keep.
    </p>
  );
}
