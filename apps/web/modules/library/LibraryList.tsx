import { LibraryItem, type LibraryEntry } from "./LibraryItem";
import styles from "./library.module.css";

export function LibraryList({ entries, woodland = false }: { entries: LibraryEntry[]; woodland?: boolean }) {
  if (entries.length === 0) {
    return <p className={styles.empty}>{woodland ? 'Your journal has room for something good. Import a recipe or write one yourself.' : 'Nothing here yet. Import something above.'}</p>;
  }
  return (
    <ul className={styles.list}>
      {entries.map((entry) => (
        <LibraryItem key={entry.id} entry={entry} woodland={woodland} />
      ))}
    </ul>
  );
}

export function LibraryNotice({ children }: { children: React.ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}
