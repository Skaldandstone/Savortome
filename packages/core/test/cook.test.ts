import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clampStep,
  cookProgress,
  formatDuration,
  pauseTimer,
  remainingSeconds,
  resetTimer,
  resumeTimer,
  startTimer,
  timerLabel,
  timerState,
  timestampUrl,
} from "../src/cook.js";

const T0 = 1_700_000_000_000;
const step = (n: number, text: string, timerSeconds: number | null) => ({ n, text, timerSeconds });

describe("timers", () => {
  it("anchors to the clock rather than counting ticks", () => {
    const timer = startTimer(step(1, "Simmer for 20 minutes.", 1200), T0);
    assert.equal(timer.endsAt, T0 + 1_200_000);
    assert.equal(remainingSeconds(timer, T0), 1200);
    assert.equal(remainingSeconds(timer, T0 + 60_000), 1140);

    // The whole point: nothing has to be running for this to stay right.
    assert.equal(remainingSeconds(timer, T0 + 1_199_000), 1);
  });

  it("keeps counting once it's overdue", () => {
    const timer = startTimer(step(1, "Rest.", 60), T0);
    assert.equal(remainingSeconds(timer, T0 + 63_000), -3);
    assert.equal(timerState(timer, T0 + 63_000), "ringing");
  });

  it("rings the moment it hits zero", () => {
    const timer = startTimer(step(1, "Rest.", 60), T0);
    assert.equal(timerState(timer, T0 + 59_000), "running");
    assert.equal(timerState(timer, T0 + 60_000), "ringing");
  });

  it("freezes where it was when paused", () => {
    const running = startTimer(step(1, "Simmer.", 600), T0);
    const paused = pauseTimer(running, T0 + 100_000);

    assert.equal(timerState(paused, T0 + 100_000), "paused");
    assert.equal(remainingSeconds(paused, T0 + 100_000), 500);
    // Time passing while paused costs nothing.
    assert.equal(remainingSeconds(paused, T0 + 900_000), 500);
  });

  it("picks up where it left off when resumed", () => {
    const running = startTimer(step(1, "Simmer.", 600), T0);
    const paused = pauseTimer(running, T0 + 100_000);
    const resumed = resumeTimer(paused, T0 + 900_000);

    assert.equal(remainingSeconds(resumed, T0 + 900_000), 500);
    assert.equal(remainingSeconds(resumed, T0 + 1_000_000), 400);
  });

  it("ignores pausing something already paused, and resuming something running", () => {
    const running = startTimer(step(1, "Simmer.", 600), T0);
    const paused = pauseTimer(running, T0 + 100_000);

    assert.deepEqual(pauseTimer(paused, T0 + 500_000), paused);
    assert.deepEqual(resumeTimer(running, T0 + 500_000), running);
  });

  it("resets to the full duration, stopped", () => {
    const running = startTimer(step(1, "Simmer.", 600), T0);
    const reset = resetTimer(running);

    assert.equal(timerState(reset, T0 + 500_000), "paused");
    assert.equal(remainingSeconds(reset, T0 + 500_000), 600);
  });
});

describe("formatDuration", () => {
  it("reads as a clock", () => {
    assert.equal(formatDuration(0), "0:00");
    assert.equal(formatDuration(9), "0:09");
    assert.equal(formatDuration(90), "1:30");
    assert.equal(formatDuration(600), "10:00");
    assert.equal(formatDuration(3600), "1:00:00");
    assert.equal(formatDuration(3725), "1:02:05");
  });

  it("keeps the sign when overdue", () => {
    assert.equal(formatDuration(-14), "-0:14");
    assert.equal(formatDuration(-3661), "-1:01:01");
  });
});

describe("timerLabel", () => {
  it("takes the first clause, so it can be read at a glance", () => {
    assert.equal(timerLabel("Simmer, stirring occasionally, for 20 minutes."), "Simmer");
    assert.equal(timerLabel("Bake until golden."), "Bake until golden");
  });

  it("truncates something long rather than wrapping across the screen", () => {
    assert.equal(
      timerLabel("Cook the onions slowly over a low heat until deeply golden"),
      "Cook the onions slowly over a…",
    );
  });

  it("always has something to show", () => {
    assert.equal(timerLabel("   "), "Timer");
  });
});

describe("timestampUrl", () => {
  it("jumps into the video at the second the step happens", () => {
    assert.equal(
      timestampUrl({ kind: "youtube", url: "https://youtu.be/abc" }, 245),
      "https://youtu.be/abc?t=245s",
    );
    assert.equal(
      timestampUrl({ kind: "youtube", url: "https://www.youtube.com/watch?v=abc" }, 245),
      "https://www.youtube.com/watch?v=abc&t=245s",
    );
  });

  it("has nothing to offer for anything else", () => {
    assert.equal(timestampUrl({ kind: "web", url: "https://example.test/post" }, 10), null);
    assert.equal(timestampUrl({ kind: "youtube", url: null }, 10), null);
  });
});

describe("progress", () => {
  it("counts what's ticked off", () => {
    assert.deepEqual(cookProgress(new Set([1, 2]), 4), {
      done: 2,
      total: 4,
      fraction: 0.5,
      finished: false,
    });
  });

  it("is finished only when every step is", () => {
    assert.equal(cookProgress(new Set([1, 2, 3]), 3).finished, true);
    assert.equal(cookProgress(new Set([1, 3]), 3).finished, false);
  });

  it("ignores ticks for steps that no longer exist", () => {
    // A recipe edited mid-cook loses a step; the count must not overshoot.
    assert.deepEqual(cookProgress(new Set([1, 2, 7]), 2), {
      done: 2,
      total: 2,
      fraction: 1,
      finished: true,
    });
  });

  it("has nothing to finish when there are no steps", () => {
    assert.equal(cookProgress(new Set(), 0).finished, false);
    assert.equal(cookProgress(new Set(), 0).fraction, 0);
  });
});

describe("navigation", () => {
  it("never falls off either end", () => {
    assert.equal(clampStep(-3, 5), 0);
    assert.equal(clampStep(9, 5), 4);
    assert.equal(clampStep(2, 5), 2);
    assert.equal(clampStep(0, 0), 0);
  });
});
