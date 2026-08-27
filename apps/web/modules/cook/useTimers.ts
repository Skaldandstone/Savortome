"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { notifyTimerDone, requestNotifyPermission } from "./notify";

/**
 * Every timer running in a cook session.
 *
 * Several at once is the normal case — rice on, onions going, something in the
 * oven — so they're keyed by the step they came from and live above the step
 * you happen to be looking at.
 */
export function useTimers(initial: CookTimer[] = [], recipeTitle = "") {
  const [timers, setTimers] = useState<CookTimer[]>(initial);
  const [now, setNow] = useState(() => Date.now());
  const alarmed = useRef(new Set<number>());

  // Nothing is animating while every timer is paused, so nothing needs to tick.
  const anyRunning = timers.some((t) => t.endsAt !== null);
  useEffect(() => {
    if (!anyRunning) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [anyRunning]);

  // A timer that finishes while you're reading a different step has to say so
  // out loud — the whole reason to set one is that you walked away.
  useEffect(() => {
    for (const timer of timers) {
      if (timerState(timer, now) === "ringing" && !alarmed.current.has(timer.stepN)) {
        alarmed.current.add(timer.stepN);
        // Reaches someone who has switched tabs, which the beep does not.
        notifyTimerDone(timer, recipeTitle);
        ring();
      }
    }
  }, [timers, now]);

  const replace = useCallback((stepN: number, change: (timer: CookTimer) => CookTimer) => {
    setTimers((current) => current.map((t) => (t.stepN === stepN ? change(t) : t)));
  }, []);

  const start = useCallback((step: Step) => {
    // Asked here rather than on page load: starting a timer is the gesture
    // that makes the request make sense, and an unprompted one gets dismissed.
    void requestNotifyPermission();
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
      setTimers((current) => current.filter((t) => t.stepN !== stepN));
    },
    /** Put back a set of timers read out of a saved session. */
    restore: (saved: CookTimer[]) => {
      const at = Date.now();
      // Only a timer that had *already* finished has had its alarm; re-sounding
      // that one on a reload would be startling. One still counting down has
      // not rung yet and must be allowed to, or restoring a session quietly
      // disarms every timer in it.
      for (const t of saved) {
        if (timerState(t, at) === "ringing") alarmed.current.add(t.stepN);
      }
      setTimers(saved);
    },
    timerFor: (stepN: number) => timers.find((t) => t.stepN === stepN) ?? null,
    remaining: (timer: CookTimer) => remainingSeconds(timer, now),
    stateOf: (timer: CookTimer) => timerState(timer, now),
  };
}

/**
 * Two short beeps, synthesised rather than shipped as a file.
 *
 * Autoplay policy allows this because starting a timer is itself a click, and
 * a failure here is silent by design: the ringing state is on screen anyway.
 */
function ring(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const at = ctx.currentTime;

    for (const offset of [0, 0.32]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, at + offset);
      gain.gain.exponentialRampToValueAtTime(0.25, at + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + offset + 0.22);
      osc.start(at + offset);
      osc.stop(at + offset + 0.24);
    }

    window.setTimeout(() => void ctx.close(), 1000);
  } catch {
    // No audio available. The screen is still shouting.
  }
}
