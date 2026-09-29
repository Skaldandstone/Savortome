import Link from "next/link";
import { LibraryItem, type LibraryEntry } from "./LibraryItem";
import styles from "./library.module.css";

export function LibraryList({ entries, woodland = false }: { entries: LibraryEntry[]; woodland?: boolean }) {
  if (entries.length === 0) {
    return <div className={styles.emptyBlock}>
      <p className={styles.empty}>{woodland ? 'Your journal is ready for its first recipe.' : 'Your library is ready for its first recipe.'}</p>
      <Link className={styles.emptyLink} href="/discover">Browse starter recipes</Link>
    </div>;
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
