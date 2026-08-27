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

/**
 * Every timer running in a cook session.
 *
 * Several at once is the normal case — rice on, onions going, something in the
 * oven — so they're keyed by the step they came from and live above the step
 * you happen to be looking at.
 */
export function useTimers() {
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

  const start = useCallback((step: Step) => {
    alarmed.current.delete(step.n);
    setTimers((current) => [
      ...current.filter((t) => t.stepN !== step.n),
      startTimer(step, Date.now()),
    ]);
  }, []);

  return {
    timers,
    now,
    start,
    pause: (stepN: number) => replace(stepN, (t) => pauseTimer(t, Date.now())),
    resume: (stepN: number) => replace(stepN, (t) => resumeTimer(t, Date.now())),
    reset: (stepN: number) => {
      alarmed.current.delete(stepN);
      replace(stepN, resetTimer);
    },
    dismiss: (stepN: number) => {
      alarmed.current.delete(stepN);
      Vibration.cancel();
      setTimers((current) => current.filter((t) => t.stepN !== stepN));
    },
    /** Put back a set of timers read out of a saved session. */
    restore: (saved: CookTimer[]) => {
      // Anything already ringing when the session was saved has had its buzz;
      // re-firing it on reopen would be startling rather than useful.
      for (const t of saved) alarmed.current.add(t.stepN);
      setTimers(saved);
    },
    timerFor: (stepN: number) => timers.find((t) => t.stepN === stepN) ?? null,
    remaining: (timer: CookTimer) => remainingSeconds(timer, now),
    stateOf: (timer: CookTimer) => timerState(timer, now),
  };
}
