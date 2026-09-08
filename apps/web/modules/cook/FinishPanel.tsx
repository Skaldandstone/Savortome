"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client";
import { StarRating } from "@/modules/shelves";
import { Button, Callout, TextArea } from "@/ui";
import styles from "./cook.module.css";

/**
 * What happens when the last step is ticked.
 *
 * Cooking something is the strongest signal there is about what a person
 * actually makes — stronger than a star, which is why the counter is bumped
 * here whether or not they rate it. Asking now also catches the one moment
 * they have an opinion; a week later nobody goes back to rate anything.
 */
export function FinishPanel({ recipeId }: { recipeId: string }) {
  const [stars, setStars] = useState(0);
  const [review, setReview] = useState("");
  const [counted, setCounted] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Marking it cooked isn't a decision worth interrupting anyone for — they
  // just cooked it. Rating is the part that's asked rather than assumed.
  useEffect(() => {
    let cancelled = false;
    void api
      .setStatus(recipeId, "cooked")
      .then(() => {
        if (!cancelled) setCounted(true);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't record that.");
      });
    return () => {
      cancelled = true;
    };
  }, [recipeId]);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    panel.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: "end" });
  }, []);

  const rate = async (value: number) => {
    setStars(value);
    setError(null);
    try {
      await api.rateRecipe(recipeId, value, review.trim() || null);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that rating.");
    }
  };

  return (
    <div className={styles.finish} ref={panel}>
      <h2 className={styles.finishTitle}>That&apos;s the lot.</h2>
      <p className={styles.finishBody}>
        {counted ? "Marked as cooked and added to your count." : "Recording that you made it…"}
      </p>

      <div className={styles.rate}>
        <span className={styles.rateLabel}>How was it?</span>
        <StarRating stars={stars} onRate={(value) => void rate(value)} />
      </div>

      {stars > 0 ? (
        <div className={styles.review}>
          <TextArea
            value={review}
            rows={2}
            placeholder="Anything you'd do differently next time?"
            aria-label="Review"
            onChange={(e) => setReview(e.target.value)}
            onBlur={() => void rate(stars)}
          />
        </div>
      ) : null}

      {error ? (
        <Callout tone="error" role="alert">
          {error}
        </Callout>
      ) : saved ? (
        <p className={styles.finishBody}>Saved.</p>
      ) : null}

      <div className={styles.finishActions}>
        <Button
          type="button"
          onClick={() => {
            router.push(`/recipe/${recipeId}`);
            // The recipe page renders on the server and needs telling that the
            // cook count and rating just moved.
            router.refresh();
          }}
        >
          Back to the recipe
        </Button>
      </div>
    </div>
  );
}
