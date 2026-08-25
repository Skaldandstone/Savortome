"use client";

import Link from "next/link";
import { formatMinutes, type DiscoverCard } from "@nomnom/core/format";
import styles from "./discover.module.css";

/** One shared recipe, as it appears while browsing. */
export function RecipeCardLink({ card }: { card: DiscoverCard }) {
  const meta = [
    formatMinutes(card.totalMinutes),
    card.cuisine,
    card.saveCount > 0 ? `${card.saveCount} saved` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li>
      <Link className={styles.card} href={`/r/${card.recipeId}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.thumb} src={card.imageUrl ?? undefined} alt="" />
        <span className={styles.body}>
          <strong className={styles.title}>{card.title}</strong>
          {card.reason ? <span className={styles.reason}>{card.reason}</span> : null}
          {card.description ? (
            <span className={styles.description}>{card.description}</span>
          ) : null}
          <span className={styles.meta}>
            by {card.sharedBy.displayName}
            {meta ? ` · ${meta}` : ""}
          </span>
        </span>
      </Link>
    </li>
  );
}

export function DiscoverCards({ cards }: { cards: DiscoverCard[] }) {
  if (cards.length === 0) return null;
  return (
    <ul className={styles.cards}>
      {cards.map((card) => (
        <RecipeCardLink key={card.recipeId} card={card} />
      ))}
    </ul>
  );
}
