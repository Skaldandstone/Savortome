"use client";

import { formatDuration, type CookTimer, type TimerState } from "@nomnom/core/format";
import styles from "./cook.module.css";

/**
 * Every running timer, pinned above the step you're reading.
 *
 * Timers belong to the session, not to the step that started them: the reason
 * you set one is so you can move on, and a timer you have to navigate back to
 * is a timer you'll forget.
 */
export function TimerTray({
  timers,
  remaining,
  stateOf,
  onPause,
  onResume,
  onReset,
  onDismiss,
}: {
  timers: CookTimer[];
  remaining: (timer: CookTimer) => number;
  stateOf: (timer: CookTimer) => TimerState;
  onPause: (stepN: number) => void;
  onResume: (stepN: number) => void;
  onReset: (stepN: number) => void;
  onDismiss: (stepN: number) => void;
}) {
  if (timers.length === 0) return null;

  return (
    <div className={styles.tray}>
      {timers.map((timer) => {
        const state = stateOf(timer);
        const left = remaining(timer);

        return (
          <div key={timer.stepN} className={styles.timer} data-state={state}>
            <div className={styles.timerHead}>
              <span className={styles.timerStep}>Step {timer.stepN}</span>
              <span className={styles.timerLabel}>{timer.label}</span>
            </div>

            <span
              className={styles.timerClock}
              // Announced only when it rings; a per-second live region would
              // read the whole countdown aloud.
              role={state === "ringing" ? "alert" : undefined}
            >
              {state === "ringing" && left < 0 ? formatDuration(left) : formatDuration(Math.max(left, 0))}
            </span>

            {state === "ringing" ? (
              <span className={styles.timerDone}>Time&apos;s up</span>
            ) : null}

            <div className={styles.timerActions}>
              {state === "running" ? (
                <button type="button" onClick={() => onPause(timer.stepN)}>
                  Pause
                </button>
              ) : state === "paused" ? (
                <button type="button" onClick={() => onResume(timer.stepN)}>
                  Resume
                </button>
              ) : null}
              <button type="button" onClick={() => onReset(timer.stepN)}>
                Reset
              </button>
              <button type="button" onClick={() => onDismiss(timer.stepN)}>
                Clear
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
