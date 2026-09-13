import assert from "node:assert/strict";
import test from "node:test";
import {
  ONBOARDING_STEPS,
  completeOnboardingStep,
  emptyOnboardingProgress,
  readOnboardingProgress,
  revisitOnboardingStep,
} from "../src/onboarding.js";

test("onboarding starts with one clear welcome step", () => {
  assert.deepEqual(emptyOnboardingProgress(), {
    version: 1,
    current: "welcome",
    completed: [],
    finished: false,
  });
});

test("onboarding advances deterministically and completes only every known step", () => {
  let progress = emptyOnboardingProgress();
  progress = completeOnboardingStep(progress, "welcome");
  assert.equal(progress.current, "safety");
  progress = completeOnboardingStep(progress, "safety");
  assert.equal(progress.current, "cooking");
  progress = completeOnboardingStep(progress, "cooking");
  assert.equal(progress.finished, true);
  assert.deepEqual(progress.completed, ONBOARDING_STEPS);
});

test("malformed, obsolete and invented onboarding fields fail closed", () => {
  assert.deepEqual(readOnboardingProgress("not json"), emptyOnboardingProgress());
  assert.deepEqual(readOnboardingProgress(JSON.stringify({ version: 2, current: "cooking" })), emptyOnboardingProgress());
  assert.deepEqual(readOnboardingProgress(JSON.stringify({
    version: 1,
    current: "billing",
    completed: ["welcome", "diagnosis", "welcome"],
    finished: true,
    dietaryProfile: ["private-value"],
  })), {
    version: 1,
    current: "safety",
    completed: ["welcome"],
    finished: false,
  });
});

test("reviewing an earlier step keeps prior progress without claiming completion", () => {
  const finished = ONBOARDING_STEPS.reduce(completeOnboardingStep, emptyOnboardingProgress());
  assert.deepEqual(revisitOnboardingStep(finished, "safety"), {
    ...finished,
    current: "safety",
    finished: false,
  });
});
