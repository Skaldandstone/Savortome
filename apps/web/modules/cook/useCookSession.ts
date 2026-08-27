"use client";

import { useCallback, useEffect, useState } from "react";
import {
  restoreSession,
  serializeSession,
  type CookTimer,
  type RestoredSession,
} from "@nomnom/core/format";

const key = (recipeId: string) => `nomnom:cook:${recipeId}`;

/**
 * A cook in progress, kept across a reload.
 *
 * Read after mount rather than during render, deliberately: this component is
 * server-rendered first, and seeding state from `localStorage` on the client's
 * first pass is a hydration mismatch. The cost is that step 1 shows for a
 * frame before the restore lands, which is why the screen says out loud that
 * it picked up where you left off — an unexplained jump reads as a bug.
 */
export function useCookSession(recipeId: string, stepCount: number) {
  const [restored, setRestored] = useState<RestoredSession | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    try {
      setRestored(restoreSession(window.localStorage.getItem(key(recipeId)), recipeId, stepCount));
    } catch {
      // Private browsing, disabled storage, a full quota. None of it is worth
      // interrupting someone who is trying to cook.
    }
    setChecked(true);
  }, [recipeId, stepCount]);

  const save = useCallback(
    (stepIndex: number, done: ReadonlySet<number>, timers: readonly CookTimer[]) => {
      // Never write before the read has happened, or the empty state this
      // component starts in would erase the session it is about to restore.
      if (!checked) return;
      try {
        window.localStorage.setItem(
          key(recipeId),
          serializeSession(recipeId, stepIndex, done, timers),
        );
      } catch {
        // See above.
      }
    },
    [checked, recipeId],
  );

  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(key(recipeId));
    } catch {
      // See above.
    }
  }, [recipeId]);

  return { restored, checked, save, clear };
}
