import Link from "next/link";
import { formatMinutes, type StatusShelf } from "@seconds/core/format";
import { ShelfBadge } from "@/modules/shelves";
import styles from "./library.module.css";

export interface LibraryEntry {
  id: string;
  title: string;
  imageUrl: string | null;
  totalMinutes: number | null;
  ingredientCount: number;
  attribution: string;
  status: StatusShelf | null;
}

export function LibraryItem({ entry }: { entry: LibraryEntry }) {
  const meta = [
    entry.attribution,
    formatMinutes(entry.totalMinutes),
    entry.ingredientCount ? `${entry.ingredientCount} ingredients` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li>
      <Link className={styles.item} href={`/recipe/${entry.id}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.thumb} src={entry.imageUrl ?? undefined} alt="" />
        <span className={styles.text}>
          <strong>{entry.title}</strong>
          <br />
          <span className={styles.meta}>{meta}</span>
        </span>
        <ShelfBadge status={entry.status} />
      </Link>
    </li>
  );
}
