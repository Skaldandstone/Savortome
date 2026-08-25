"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  clampStep,
  cookProgress,
  formatDuration,
  timestampUrl,
  type Recipe,
} from "@nomnom/core/format";
import { IngredientList, ServingScaler, useServings } from "@/modules/recipe";
import { Button, Callout } from "@/ui";
import { FinishPanel } from "./FinishPanel";
import { TimerTray } from "./TimerTray";
import { useTimers } from "./useTimers";
import { useWakeLock } from "./useWakeLock";
import styles from "./cook.module.css";

/**
 * The recipe, one step at a time, for someone whose hands are busy.
 *
 * Everything here is sized to be read from arm's length and driven with one
 * finger or the arrow keys. The screen stays awake, timers run above whatever
 * step you're on, and finishing offers to record that you cooked it — which is
 * the signal the rest of the app leans on hardest.
 */
export function CookMode({ recipe, recipeId }: { recipe: Recipe; recipeId: string }) {
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState<ReadonlySet<number>>(() => new Set());
  const [showIngredients, setShowIngredients] = useState(false);
  const timers = useTimers();
  const servings = useServings(recipe);

  useWakeLock(true);

  const steps = recipe.steps;
  const step = steps[clampStep(index, steps.length)];
  const progress = cookProgress(done, steps.length);

  const go = (delta: number) => setIndex((i) => clampStep(i + delta, steps.length));

  const toggleDone = (n: number) =>
    setDone((current) => {
      const next = new Set(current);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  /** Tick the step off and move on — the single gesture the whole screen is for. */
  const completeAndAdvance = () => {
    if (!step) return;
    setDone((current) => new Set(current).add(step.n));
    if (index < steps.length - 1) go(1);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Typing in the finish panel's review box shouldn't page through steps.
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      if (event.key === "ArrowRight") go(1);
      else if (event.key === "ArrowLeft") go(-1);
      else return;
      event.preventDefault();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps.length]);

  if (!step) {
    return (
      <Callout tone="warn" title="Nothing to cook from">
        This recipe has no steps yet. <Link href={`/recipe/${recipeId}/edit`}>Add some</Link> and
        come back.
      </Callout>
    );
  }

  const timer = timers.timerFor(step.n);
  const videoLink = step.sourceTimestamp !== null
    ? timestampUrl(recipe.source, step.sourceTimestamp)
    : null;

  return (
    <div className={styles.cook}>
      <header className={styles.header}>
        <Link className={styles.exit} href={`/recipe/${recipeId}`}>
          ← {recipe.title}
        </Link>
        <button
          type="button"
          className={styles.ingredientsToggle}
          aria-expanded={showIngredients}
          onClick={() => setShowIngredients((s) => !s)}
        >
          {showIngredients ? "Hide" : "Show"} ingredients
        </button>
      </header>

      {showIngredients ? (
        <div className={styles.ingredients}>
          {servings.canScale && servings.servings !== null ? (
            <ServingScaler
              servings={servings.servings}
              onIncrement={servings.increment}
              onDecrement={servings.decrement}
            />
          ) : null}
          <IngredientList ingredients={servings.ingredients} />
        </div>
      ) : null}

      <TimerTray
        timers={timers.timers}
        remaining={timers.remaining}
        stateOf={timers.stateOf}
        onPause={timers.pause}
        onResume={timers.resume}
        onReset={timers.reset}
        onDismiss={timers.dismiss}
      />

      <div
        className={styles.progress}
        role="progressbar"
        aria-valuenow={progress.done}
        aria-valuemin={0}
        aria-valuemax={progress.total}
        aria-label="Steps done"
      >
        <div className={styles.progressFill} style={{ width: `${progress.fraction * 100}%` }} />
      </div>

      <main className={styles.stage}>
        <p className={styles.counter}>
          Step {step.n} of {steps.length}
        </p>
        <p className={styles.text} data-done={done.has(step.n)}>
          {step.text}
        </p>

        <div className={styles.stepExtras}>
          {step.timerSeconds ? (
            timer ? (
              // The tray above is doing the shouting; this just says which
              // state the timer for *this* step is in.
              <span className={styles.timerRunning} data-state={timers.stateOf(timer)}>
                {timers.stateOf(timer) === "ringing"
                  ? "Timer finished"
                  : timers.stateOf(timer) === "paused"
                    ? `Timer paused — ${formatDuration(timers.remaining(timer))}`
                    : `Timer running — ${formatDuration(Math.max(timers.remaining(timer), 0))}`}
              </span>
            ) : (
              <Button type="button" variant="ghost" onClick={() => timers.start(step)}>
                ⏱ Start {formatDuration(step.timerSeconds)}
              </Button>
            )
          ) : null}

          {videoLink ? (
            <a className={styles.watch} href={videoLink} target="_blank" rel="noreferrer noopener">
              ▶ Watch this bit
            </a>
          ) : null}
        </div>
      </main>

      <nav className={styles.controls}>
        <Button type="button" variant="ghost" disabled={index === 0} onClick={() => go(-1)}>
          ← Back
        </Button>

        <Button type="button" onClick={completeAndAdvance}>
          {index === steps.length - 1 ? "Finish" : "Done — next →"}
        </Button>

        {done.has(step.n) ? (
          <button type="button" className={styles.aside} onClick={() => toggleDone(step.n)}>
            Untick this step
          </button>
        ) : index < steps.length - 1 ? (
          // Skipping moves on without ticking, so the recipe never claims you
          // did something you didn't.
          <button type="button" className={styles.aside} onClick={() => go(1)}>
            Skip
          </button>
        ) : null}
      </nav>

      {progress.finished ? <FinishPanel recipeId={recipeId} /> : null}
    </div>
  );
}
