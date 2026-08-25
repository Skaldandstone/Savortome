"use client";

import { useState } from "react";
import { MAX_STARS } from "@nomnom/core/format";
import styles from "./shelves.module.css";

const STARS = Array.from({ length: MAX_STARS }, (_, i) => i + 1);

/** Five stars, keyboard reachable, with hover preview. Zero means "not rated yet". */
export function StarRating({
  stars,
  disabled,
  onRate,
}: {
  stars: number;
  disabled?: boolean;
  onRate: (stars: number) => void;
}) {
  const [preview, setPreview] = useState<number | null>(null);
  const shown = preview ?? stars;

  return (
    <div
      className={styles.stars}
      role="radiogroup"
      aria-label="Your rating"
      onMouseLeave={() => setPreview(null)}
    >
      {STARS.map((value) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={stars === value}
          aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
          disabled={disabled}
          className={styles.star}
          data-filled={value <= shown}
          onMouseEnter={() => setPreview(value)}
          onFocus={() => setPreview(value)}
          onBlur={() => setPreview(null)}
          onClick={() => onRate(value)}
        >
          ★
        </button>
      ))}
    </div>
  );
}
