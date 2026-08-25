import type { Step } from "./recipe.js";

/**
 * Cooking from a card, rather than reading one.
 *
 * The extractor already pulls a hands-off duration out of every step it can
 * ("simmer for 20 minutes") and, for videos, the second the step happens at.
 * Until now both were badges. This is the part that uses them.
 */

export interface CookTimer {
  /** The step it came off, 1-based, which is also its identity in a session. */
  stepN: number;
  label: string;
  totalSeconds: number;
  /**
   * Wall-clock epoch milliseconds when it rings; null while paused.
   *
   * Deliberately not a countdown that decrements on a tick. A tick-based timer
   * drifts, and stops entirely when the tab is backgrounded or the phone
   * sleeps — which is precisely when someone walks away from a simmering pot.
   * Anchoring to the clock means the display is derived, and being asleep for
   * ten minutes costs nothing.
   */
  endsAt: number | null;
  /** Seconds left at the moment it was paused. Only meaningful while paused. */
  pausedRemaining: number | null;
}

export type TimerState = "running" | "paused" | "ringing";

export function startTimer(step: Pick<Step, "n" | "text" | "timerSeconds">, now: number): CookTimer {
  const totalSeconds = step.timerSeconds ?? 0;
  return {
    stepN: step.n,
    label: timerLabel(step.text),
    totalSeconds,
    endsAt: now + totalSeconds * 1000,
    pausedRemaining: null,
  };
}

export function pauseTimer(timer: CookTimer, now: number): CookTimer {
  if (timer.endsAt === null) return timer;
  return { ...timer, endsAt: null, pausedRemaining: remainingSeconds(timer, now) };
}

export function resumeTimer(timer: CookTimer, now: number): CookTimer {
  if (timer.endsAt !== null) return timer;
  return {
    ...timer,
    endsAt: now + (timer.pausedRemaining ?? 0) * 1000,
    pausedRemaining: null,
  };
}

/** Back to the full duration, stopped — for when a step needs another go. */
export function resetTimer(timer: CookTimer): CookTimer {
  return { ...timer, endsAt: null, pausedRemaining: timer.totalSeconds };
}

/**
 * Seconds left, negative once it's overdue.
 *
 * Overdue keeps counting rather than sticking at zero: "3 minutes past" is the
 * thing you want to know when you come back to the kitchen and something
 * smells wrong.
 */
export function remainingSeconds(timer: CookTimer, now: number): number {
  if (timer.endsAt === null) return timer.pausedRemaining ?? 0;
  return Math.round((timer.endsAt - now) / 1000);
}

export function timerState(timer: CookTimer, now: number): TimerState {
  if (timer.endsAt === null) return "paused";
  return remainingSeconds(timer, now) <= 0 ? "ringing" : "running";
}

/** mm:ss, or h:mm:ss past an hour. Overdue keeps the sign. */
export function formatDuration(seconds: number): string {
  const sign = seconds < 0 ? "-" : "";
  const total = Math.abs(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${sign}${h}:${pad(m)}:${pad(s)}` : `${sign}${m}:${pad(s)}`;
}

/**
 * A short name for a timer, taken from the step it belongs to.
 *
 * Steps are whole sentences and a running timer needs a label you can read at
 * a glance from across the kitchen, so this takes the first clause and stops.
 */
export function timerLabel(text: string): string {
  const firstClause = text.trim().split(/[.,;:]/)[0]?.trim() ?? "";
  const words = firstClause.split(/\s+/).filter(Boolean);
  if (words.length === 0) return "Timer";
  const short = words.slice(0, 6).join(" ");
  return words.length > 6 ? `${short}…` : short;
}

const TIMER_RE =
  /\b(?:for\s+)?(?:about\s+|around\s+)?(\d+(?:\.\d+)?)\s*(?:-|–|to)?\s*(\d+)?\s*(second|sec|minute|min|hour|hr)s?\b/i;

/**
 * Pull a hands-off duration out of step prose so the app can offer a timer.
 *
 * Deterministic and cheap, which is why it runs on hand-written steps too:
 * someone typing "simmer for 20 minutes" gets a working timer without also
 * having to fill in a timer field they'd never think to look for.
 */
export function timerFromStep(text: string): number | null {
  const m = TIMER_RE.exec(text);
  if (!m) return null;
  const lo = Number(m[1]);
  const hi = m[2] ? Number(m[2]) : lo;
  const unit = (m[3] as string).toLowerCase();
  const mult = unit.startsWith("s") ? 1 : unit.startsWith("m") ? 60 : 3600;
  return Math.round(((lo + hi) / 2) * mult);
}

/** Deep-link back to the exact second of the source video. */
export function timestampUrl(
  source: { kind: string; url: string | null },
  seconds: number,
): string | null {
  if (!source.url || source.kind !== "youtube") return null;
  return `${source.url}${source.url.includes("?") ? "&" : "?"}t=${seconds}s`;
}

// ---------------------------------------------------------------- progress

export interface CookProgress {
  /** How many steps are ticked off. */
  done: number;
  total: number;
  /** 0-1, for a progress bar. */
  fraction: number;
  /** True once every step is ticked — what offers to mark the recipe cooked. */
  finished: boolean;
}

export function cookProgress(doneSteps: ReadonlySet<number>, total: number): CookProgress {
  // Only count steps that actually exist: a session held across an edit could
  // otherwise report more done than there are.
  let done = 0;
  for (let n = 1; n <= total; n++) if (doneSteps.has(n)) done++;

  return {
    done,
    total,
    fraction: total === 0 ? 0 : done / total,
    finished: total > 0 && done === total,
  };
}

/** Move through the steps without ever falling off either end. */
export const clampStep = (index: number, total: number): number =>
  total === 0 ? 0 : Math.min(Math.max(index, 0), total - 1);
