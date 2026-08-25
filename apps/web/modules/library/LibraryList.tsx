import { LibraryItem, type LibraryEntry } from "./LibraryItem";
import styles from "./library.module.css";

export function LibraryList({ entries }: { entries: LibraryEntry[] }) {
  if (entries.length === 0) {
    return <p className={styles.empty}>Nothing here yet. Import something above.</p>;
  }
  return (
    <ul className={styles.list}>
      {entries.map((entry) => (
        <LibraryItem key={entry.id} entry={entry} />
      ))}
    </ul>
  );
}

export function LibraryNotice({ children }: { children: React.ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}
