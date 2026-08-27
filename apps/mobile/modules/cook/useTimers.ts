import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, Vibration } from "react-native";
import {
  pauseTimer,
  remainingSeconds,
  resetTimer,
  resumeTimer,
  startTimer,
  timerState,
  type CookTimer,
  type Step,
} from "@seconds/core/format";
import { cancelTimerNotification, scheduleTimerNotification } from "./notify";

/**
 * Every timer running in a cook session.
 *
 * Several at once is the normal case — rice on, onions going, something in the
 * oven — so they're keyed by the step they came from and live above the step
 * you happen to be looking at.
 */
export function useTimers(recipeTitle = "") {
  const [timers, setTimers] = useState<CookTimer[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const alarmed = useRef(new Set<number>());

  // Nothing is animating while every timer is paused, so nothing needs to tick.
  const anyRunning = timers.some((t) => t.endsAt !== null);
  useEffect(() => {
    if (!anyRunning) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [anyRunning]);

  // A timer that finishes while you're reading a different step has to make
  // itself felt — the whole reason to set one is that you walked away.
  useEffect(() => {
    for (const timer of timers) {
      if (timerState(timer, now) === "ringing" && !alarmed.current.has(timer.stepN)) {
        alarmed.current.add(timer.stepN);
        // A phone face-down next to the hob is heard through the worktop, not
        // seen. Android takes a pattern; iOS ignores it and buzzes once.
        Vibration.vibrate(Platform.OS === "android" ? [0, 400, 200, 400] : 400);
      }
    }
  }, [timers, now]);

  const replace = useCallback((stepN: number, change: (timer: CookTimer) => CookTimer) => {
    setTimers((current) => current.map((t) => (t.stepN === stepN ? change(t) : t)));
  }, []);

  const start = useCallback(
    (step: Step) => {
      alarmed.current.delete(step.n);
      const timer = startTimer(step, Date.now());
      setTimers((current) => [...current.filter((t) => t.stepN !== step.n), timer]);
      // The OS holds this one, so it fires with the app closed — which is the
      // entire reason anyone sets a cook timer.
      void scheduleTimerNotification(timer, recipeTitle);
    },
    [recipeTitle],
  );

  return {
    timers,
    now,
    start,
    pause: (stepN: number) => {
      // Cancel first: a paused timer that still rings the phone is worse than
      // no timer at all.
      void cancelTimerNotification(stepN);
      replace(stepN, (t) => pauseTimer(t, Date.now()));
    },
    resume: (stepN: number) =>
      replace(stepN, (t) => {
        const resumed = resumeTimer(t, Date.now());
        void scheduleTimerNotification(resumed, recipeTitle);
        return resumed;
      }),
    reset: (stepN: number) => {
      alarmed.current.delete(stepN);
      void cancelTimerNotification(stepN);
      replace(stepN, resetTimer);
    },
    dismiss: (stepN: number) => {
      alarmed.current.delete(stepN);
      void cancelTimerNotification(stepN);
      Vibration.cancel();
      setTimers((current) => current.filter((t) => t.stepN !== stepN));
    },
    /** Put back a set of timers read out of a saved session. */
    restore: (saved: CookTimer[]) => {
      const at = Date.now();
      // Only a timer that had *already* finished has had its buzz; re-firing
      // that one on reopen would be startling. One still counting down has not
      // rung yet and must be allowed to, or restoring a session quietly
      // disarms every timer in it.
      for (const t of saved) {
        if (timerState(t, at) === "ringing") alarmed.current.add(t.stepN);
      }
      setTimers(saved);
      // Reopening the app after it was killed loses whatever the OS had
      // queued, so anything still running is handed back to it.
      for (const t of saved) {
        if (t.endsAt !== null) void scheduleTimerNotification(t, recipeTitle);
      }
    },
    timerFor: (stepN: number) => timers.find((t) => t.stepN === stepN) ?? null,
    remaining: (timer: CookTimer) => remainingSeconds(timer, now),
    stateOf: (timer: CookTimer) => timerState(timer, now),
  };
}
