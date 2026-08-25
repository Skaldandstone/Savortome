"use client";

import { useEffect } from "react";

/**
 * Keep the screen on while cooking.
 *
 * A phone propped against the sugar tin locks itself every thirty seconds, and
 * unlocking it with batter on your hands is exactly the moment the app stops
 * being worth using. Not every browser has this; where it's missing, nothing
 * happens and nothing complains.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let released = false;

    const request = async () => {
      try {
        sentinel = await navigator.wakeLock.request("screen");
      } catch {
        // Denied, or the tab isn't visible. Either way there's nothing to do.
      }
    };

    // The lock is dropped whenever the tab is hidden and is not restored on its
    // own, so switching away to a timer app and back has to re-take it.
    const reacquire = () => {
      if (!released && document.visibilityState === "visible") void request();
    };

    void request();
    document.addEventListener("visibilitychange", reacquire);

    return () => {
      released = true;
      document.removeEventListener("visibilitychange", reacquire);
      void sentinel?.release().catch(() => undefined);
    };
  }, [active]);
}
