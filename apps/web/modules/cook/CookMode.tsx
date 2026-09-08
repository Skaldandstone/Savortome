"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import {
  clampStep,
  cookProgress,
  actionCueForStep,
  formatDuration,
  ingredientAmountsByStep,
  stepSwipeDelta,
  techniquesForStep,
  timestampUrl,
  type Recipe,
} from "@seconds/core/format";
import { IngredientList, ServingScaler, useServings } from "@/modules/recipe";
import { AllergenWarning } from "@/modules/profile";
import { Button, Callout } from "@/ui";
import { FinishPanel } from "./FinishPanel";
import { TimerTray } from "./TimerTray";
import { useCookSession } from "./useCookSession";
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
  const [showResumed, setShowResumed] = useState(false);
  const [openTechnique, setOpenTechnique] = useState<string | null>(null);
  /**
   * Whether the saved session has been dealt with — restored, or found absent.
   *
   * State rather than a ref, because it has to survive being wrong: a remount
   * gets a fresh one and correctly re-reads storage. A ref looked right and
   * quietly let the second mount save before it had restored.
   */
  const [settled, setSettled] = useState(false);
  const swipeOrigin = useRef<{ x: number; y: number } | null>(null);
  const timers = useTimers([], recipe.title);
  const servings = useServings(recipe);
  const steps = recipe.steps;
  // Destructured: the hook returns a fresh object every render, and depending
  // on it made the save effect fire on every timer tick.
  const { restored, checked, save, clear } = useCookSession(recipeId, steps.length);

  useWakeLock(true);

  // Apply a saved session once the read has landed, then let saving begin.
  useEffect(() => {
    if (!checked || settled) return;
    if (restored) {
      setIndex(restored.stepIndex);
      setDone(restored.done);
      timers.restore(restored.timers);
      setShowResumed(true);
    }
    setSettled(true);
    // timers is rebuilt every render; depending on it would re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, restored, settled]);

  const step = steps[clampStep(index, steps.length)];
  const progress = cookProgress(done, steps.length);

  // Scaled ingredients, so the amount beside a step matches the one the cook
  // set at the top. Recomputed only when that scaling changes, not per step.
  const stepAmounts = useMemo(
    () => ingredientAmountsByStep(steps, servings.ingredients),
    [steps, servings.ingredients],
  );

  // Keep the saved session in step with what's on screen — but never before
  // the restore has settled, or this writes the empty state it starts in over
  // the session it is about to read.
  useEffect(() => {
    if (!settled) return;
    if (progress.finished) clear();
    else save(index, done, timers.timers);
  }, [settled, index, done, timers.timers, progress.finished, save, clear]);


  const go = (delta: number) => setIndex((i) => clampStep(i + delta, steps.length));

  useEffect(() => { setOpenTechnique(null); }, [index]);

  /** Throw the restored session away and begin the recipe again. */
  const startOver = () => {
    setShowResumed(false);
    setIndex(0);
    setDone(new Set());
    for (const timer of timers.timers) timers.dismiss(timer.stepN);
    clear();
  };

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

  const amountsForThisStep = stepAmounts.get(step.n) ?? [];
  const forThisStep = amountsForThisStep.map(({ ingredient }) => ingredient);
  const actionCue = actionCueForStep(step.text);
  const techniques = techniquesForStep(step.text);
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
        <div className={styles.ingredients} role="region" aria-label="Recipe ingredients" tabIndex={0}>
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

      {/* An unexplained jump to step 4 reads as a bug; saying so makes it a
          feature. Dismissible, because it's only interesting once. */}
      {showResumed ? (
        <div className={styles.resumed} role="status">
          <span>Picked up where you left off.</span>
          <button type="button" onClick={startOver}>
            Start over
          </button>
        </div>
      ) : null}

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

      <section
        className={styles.stage}
        aria-label={`Step ${step.n} of ${steps.length}: ${actionCue.label}`}
        aria-describedby="cook-swipe-hint"
        tabIndex={0}
        onPointerDown={(event: ReactPointerEvent<HTMLElement>) => {
          if (event.pointerType === "mouse") return;
          swipeOrigin.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerUp={(event: ReactPointerEvent<HTMLElement>) => {
          const start = swipeOrigin.current;
          swipeOrigin.current = null;
          if (!start) return;
          const delta = stepSwipeDelta(start, { x: event.clientX, y: event.clientY });
          if (delta === 1) completeAndAdvance();
          else if (delta === -1) go(-1);
        }}
        onPointerCancel={() => { swipeOrigin.current = null; }}
      >
        <div className={styles.stageTop}>
          <p className={styles.counter}>Step {step.n} of {steps.length}</p>
          <p className={styles.stepPosition}>{progress.done} completed</p>
        </div>

        <div className={styles.stepLayout}>
          <div className={styles.actionCue} aria-hidden="true">
            <span className={styles.actionSymbol}>{actionCue.symbol}</span>
            <span className={styles.actionLabel}>{actionCue.label}</span>
          </div>

          <div className={styles.stepBody} aria-live="polite">
            {amountsForThisStep.length > 0 ? (
              <div className={styles.amountBlock}>
                <p className={styles.amountHeading}>Measure for this step</p>
                <ul className={styles.stepAmounts} aria-label="Amounts for this step">
                  {amountsForThisStep.map(({ ingredient, amount, context, exact }, amountIndex) => (
                    <li
                      key={`${ingredient.raw}-${ingredient.canonicalItem}-${amountIndex}`}
                      className={styles.stepAmount}
                      data-exact={exact}
                    >
                      <span className={styles.stepQuantity}>{amount}</span>{" "}
                      <span>{ingredient.item || ingredient.canonicalItem}</span>
                      {context ? <span className={styles.amountContext}>{context}</span> : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className={styles.instructionBlock}>
              <p className={styles.instructionLabel}>What to do</p>
              <p className={styles.text} data-done={done.has(step.n)}>{step.text}</p>
            </div>

            {techniques.length > 0 ? (
              <div className={styles.techniques} aria-label="Cooking technique help">
                <p className={styles.techniqueHeading}>How to do it</p>
                <div className={styles.techniqueLinks}>
                  {techniques.map((technique) => {
                    const expanded = openTechnique === technique.id;
                    const tipId = `technique-${technique.id}-tip`;
                    return (
                      <span key={technique.id} className={styles.technique}>
                        <button
                          type="button"
                          className={styles.techniqueLink}
                          aria-expanded={expanded}
                          aria-controls={tipId}
                          aria-describedby={expanded ? tipId : undefined}
                          onClick={() => setOpenTechnique(expanded ? null : technique.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              setOpenTechnique(null);
                              event.preventDefault();
                            }
                          }}
                        >
                          What does {technique.label.toLowerCase()} mean?
                        </button>
                        {expanded ? (
                          <span id={tipId} className={styles.techniqueTip} role="tooltip">
                            <span className={styles.techniqueVisual} aria-hidden="true">
                              {technique.visualSteps.map((visualStep, visualIndex) => (
                                <span key={visualStep} className={styles.techniqueFrame} style={{ "--frame": visualIndex } as CSSProperties}>
                                  <span className={styles.frameNumber}>{visualIndex + 1}</span>
                                  <span>{visualStep}</span>
                                </span>
                              ))}
                            </span>
                            <span>{technique.meaning}</span>
                          </span>
                        ) : null}
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {/* Scoped to just this step's own ingredients, not the whole recipe. */}
            <AllergenWarning ingredients={forThisStep} />

            <div className={styles.stepExtras}>
              {step.timerSeconds ? (
                timer ? (
                  <span className={styles.timerRunning} data-state={timers.stateOf(timer)}>
                    {timers.stateOf(timer) === "ringing"
                      ? "Timer finished"
                      : timers.stateOf(timer) === "paused"
                        ? `Timer paused: ${formatDuration(timers.remaining(timer))}`
                        : `Timer running: ${formatDuration(Math.max(timers.remaining(timer), 0))}`}
                  </span>
                ) : (
                  <Button type="button" variant="ghost" onClick={() => timers.start(step)}>
                    Start {formatDuration(step.timerSeconds)} timer
                  </Button>
                )
              ) : null}

              {videoLink ? (
                <a className={styles.watch} href={videoLink} target="_blank" rel="noreferrer noopener">
                  Watch this part
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <nav className={styles.controls} aria-label="Cooking steps">
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

      <p id="cook-swipe-hint" className={styles.swipeHint}>
        Swipe left to complete this step and continue. Swipe right to go back. Buttons and arrow keys work too.
      </p>

      {progress.finished ? <FinishPanel recipeId={recipeId} /> : null}
    </div>
  );
}
