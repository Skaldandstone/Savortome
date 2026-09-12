import Link from "next/link";
import { cookedLabel, formatMinutes, type StatusShelf } from "@seconds/core/format";
import { ShelfBadge } from "@/modules/shelves";
import styles from "./library.module.css";
import { FoodIllustration } from '@/modules/woodland/FoodIllustration';
import { KitchenIcon } from '@/modules/woodland/KitchenIcon';

export interface LibraryEntry {
  id: string;
  title: string;
  imageUrl: string | null;
  totalMinutes: number | null;
  ingredientCount: number;
  attribution: string;
  status: StatusShelf | null;
  /** Null when never rated — which is not the same as rated zero. */
  stars: number | null;
  timesCooked: number;
}

export function LibraryItem({ entry, woodland = false }: { entry: LibraryEntry; woodland?: boolean }) {
  const meta = [
    entry.attribution,
    formatMinutes(entry.totalMinutes),
    entry.ingredientCount ? `${entry.ingredientCount} ingredients` : null,
    cookedLabel(entry.timesCooked),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li>
      <Link className={styles.item} href={`/recipe/${entry.id}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {woodland && !entry.imageUrl ? <FoodIllustration foodId="journal" className={styles.thumb} /> : <img className={styles.thumb} src={entry.imageUrl ?? undefined} alt="" loading="lazy" />}
        <span className={styles.text}>
          <strong>{entry.title}</strong>
          <br />
          <span className={styles.meta}>{meta}</span>
        </span>
        {/* Your own verdict, not the community's — this is your shelf. A
            recipe cooked but never rated shows nothing rather than zero. */}
        <span className={styles.verdict}>{entry.stars && entry.stars > 0 ? (
          <span className={styles.stars} aria-label={`You rated this ${entry.stars} out of 5`}>
            {"★".repeat(entry.stars)}
            <span className={styles.starsEmpty}>{"★".repeat(5 - entry.stars)}</span>
          </span>
        ) : null}
        <ShelfBadge status={entry.status} /></span>
        {woodland && <KitchenIcon name="arrow" className={styles.arrow} />}
      </Link>
    </li>
  );
}
