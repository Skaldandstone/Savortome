import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  restoreSession,
  serializeSession,
  type CookTimer,
  type RestoredSession,
} from "@seconds/core/format";

const key = (recipeId: string) => `seconds:cook:${recipeId}`;

/**
 * A cook in progress, kept across the app being closed.
 *
 * More necessary here than on the web: a phone swaps a backgrounded app out
 * whenever it feels like it, so "I put the phone down while the oven preheated"
 * and "I closed the app" are the same event. Coming back to step 1 with every
 * timer gone is the app failing at the exact moment it was supposed to help.
 *
 * AsyncStorage is asynchronous, so the read lands a beat after mount — which is
 * why the screen says out loud that it picked up where you left off, rather
 * than silently jumping.
 */
export function useCookSession(recipeId: string, stepCount: number) {
  const [restored, setRestored] = useState<RestoredSession | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(key(recipeId));
        if (!cancelled) setRestored(restoreSession(raw, recipeId, stepCount));
      } catch {
        // Storage unavailable or corrupt. Not worth interrupting a cook over.
      }
      if (!cancelled) setChecked(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [recipeId, stepCount]);

  const save = useCallback(
    (stepIndex: number, done: ReadonlySet<number>, timers: readonly CookTimer[]) => {
      void AsyncStorage.setItem(
        key(recipeId),
        serializeSession(recipeId, stepIndex, done, timers),
      ).catch(() => undefined);
    },
    [recipeId],
  );

  const clear = useCallback(() => {
    void AsyncStorage.removeItem(key(recipeId)).catch(() => undefined);
  }, [recipeId]);

  return { restored, checked, save, clear };
}
