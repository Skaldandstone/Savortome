"use client";

import Link from "next/link";
import { describeFeedItem, type FeedItem } from "@nomnom/core/format";
import styles from "./friends.module.css";

/** Roughly how long ago, in the terms people actually use. */
function ago(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.floor(minutes)}m ago`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  const days = hours / 24;
  if (days < 7) return `${Math.floor(days)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function FeedList({ items }: { items: FeedItem[] }) {
  if (items.length === 0) {
    return (
      <p className={styles.empty}>
        Nothing here yet. Once your friends cook, rate, or share something, it shows up here.
      </p>
    );
  }

  return (
    <ul className={styles.feed}>
      {items.map((item) => (
        <li key={`${item.kind}-${item.recipeId}-${item.at}`}>
          <Link className={styles.feedItem} href={`/r/${item.recipeId}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.feedThumb} src={item.recipeImageUrl ?? undefined} alt="" />
            <span className={styles.feedText}>
              <span className={styles.feedWhat}>{describeFeedItem(item)}</span>
              <br />
              <strong>{item.recipeTitle}</strong>
              {item.review ? <span className={styles.review}> “{item.review}”</span> : null}
            </span>
            <span className={styles.feedWhen}>{ago(item.at)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
