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

// The range separator and second number used to be independently optional
// ("\s*(?:-|–|to)?\s*(\d+)?\s*"), which let three adjacent \s* groups each
// match zero or more of the same whitespace run - a classic catastrophic
// backtracking shape (confirmed by CodeQL: it hangs on step text with a long
// run of digits or tabs and no unit word to let the match succeed). Requiring
// the separator and second number as a single unit closes that ambiguity;
// only one \s* run is now reachable per position.
const TIMER_RE =
  /\b(?:for\s+)?(?:about\s+|around\s+)?(\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*(\d+))?\s*(second|sec|minute|min|hour|hr)s?\b/i;

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

// ---------------------------------------------------------------- sessions

/**
 * A cook in progress, as it survives a reload.
 *
 * Worth keeping because the moment someone closes the tab mid-recipe is
 * usually not a decision — it's a phone locking, a browser evicting a
 * background tab, an app being swapped out while the oven preheats. Coming
 * back to step 1 with every timer gone is the app failing at the exact moment
 * it was supposed to be useful.
 *
 * Timers restore *correctly* rather than approximately, which falls out of
 * anchoring them to the wall clock in the first place: `endsAt` is an absolute
 * instant, so a timer written before a reload and read after it has simply
 * been counting down the whole time.
 */
export interface CookSession {
  recipeId: string;
  stepIndex: number;
  /** Step numbers ticked off. An array because a Set doesn't survive JSON. */
  done: number[];
  timers: CookTimer[];
  savedAt: number;
}

/**
 * How long a session stays worth restoring.
 *
 * Longer than any cook, shorter than "yesterday". Offering to resume a recipe
 * from last week — and worse, restoring its long-dead timers — is noise, not
 * help.
 */
export const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export function serializeSession(
  recipeId: string,
  stepIndex: number,
  done: ReadonlySet<number>,
  timers: readonly CookTimer[],
  now: number = Date.now(),
): string {
  const session: CookSession = {
    recipeId,
    stepIndex,
    done: [...done].sort((a, b) => a - b),
    timers: [...timers],
    savedAt: now,
  };
  return JSON.stringify(session);
}

export interface RestoredSession {
  stepIndex: number;
  done: Set<number>;
  timers: CookTimer[];
}

/**
 * Read a stored session back, or decide it isn't worth restoring.
 *
 * Everything here is a reason to return null rather than to trust the blob:
 * it is whatever was in storage, which may be corrupt, may belong to a
 * different recipe, may be stale, and may describe a recipe that has since
 * been edited to have fewer steps.
 */
export function restoreSession(
  raw: string | null,
  recipeId: string,
  stepCount: number,
  now: number = Date.now(),
): RestoredSession | null {
  if (!raw) return null;

  let session: Partial<CookSession>;
  try {
    session = JSON.parse(raw) as Partial<CookSession>;
  } catch {
    return null;
  }

  if (session.recipeId !== recipeId) return null;
  if (typeof session.savedAt !== "number" || now - session.savedAt > SESSION_MAX_AGE_MS) {
    return null;
  }

  // The recipe may have been edited since. Anything pointing past the end of
  // it is dropped rather than allowed to claim progress that doesn't exist.
  const done = new Set(
    (Array.isArray(session.done) ? session.done : []).filter(
      (n) => Number.isInteger(n) && n >= 1 && n <= stepCount,
    ),
  );
  const timers = (Array.isArray(session.timers) ? session.timers : []).filter(
    (t): t is CookTimer =>
      Boolean(t) && typeof t.stepN === "number" && t.stepN >= 1 && t.stepN <= stepCount,
  );

  const stepIndex = clampStep(
    typeof session.stepIndex === "number" ? session.stepIndex : 0,
    stepCount,
  );

  // Nothing left worth restoring — don't interrupt someone to tell them so.
  if (done.size === 0 && timers.length === 0 && stepIndex === 0) return null;

  return { stepIndex, done, timers };
}
