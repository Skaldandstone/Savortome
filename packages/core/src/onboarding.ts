/**
 * Small, client-safe onboarding state.
 *
 * It records only navigation through the introduction. Food choices, pantry
 * contents and cooking preferences remain in their existing account-backed
 * stores and must never be copied into analytics or local onboarding state.
 */
export const ONBOARDING_VERSION = 1 as const;

export const ONBOARDING_STEPS = ["welcome", "safety", "cooking"] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export interface OnboardingProgress {
  version: typeof ONBOARDING_VERSION;
  current: OnboardingStep;
  completed: OnboardingStep[];
  finished: boolean;
}

export function emptyOnboardingProgress(): OnboardingProgress {
  return { version: ONBOARDING_VERSION, current: "welcome", completed: [], finished: false };
}

export function readOnboardingProgress(value: string | null | undefined): OnboardingProgress {
  if (!value) return emptyOnboardingProgress();
  try {
    const candidate = JSON.parse(value) as Record<string, unknown>;
    if (candidate.version !== ONBOARDING_VERSION) return emptyOnboardingProgress();
    const rawCompleted: unknown[] = Array.isArray(candidate.completed) ? candidate.completed : [];
    const completed = ONBOARDING_STEPS.filter(step => rawCompleted.includes(step));
    const current = ONBOARDING_STEPS.includes(candidate.current as OnboardingStep)
      ? candidate.current as OnboardingStep
      : firstIncomplete(completed);
    return {
      version: ONBOARDING_VERSION,
      current,
      completed,
      finished: candidate.finished === true && completed.length === ONBOARDING_STEPS.length,
    };
  } catch {
    return emptyOnboardingProgress();
  }
}

export function completeOnboardingStep(
  progress: OnboardingProgress,
  step: OnboardingStep,
): OnboardingProgress {
  const completed = ONBOARDING_STEPS.filter(candidate =>
    candidate === step || progress.completed.includes(candidate));
  const finished = completed.length === ONBOARDING_STEPS.length;
  return {
    version: ONBOARDING_VERSION,
    completed,
    current: finished ? "cooking" : firstIncomplete(completed),
    finished,
  };
}

export function revisitOnboardingStep(progress: OnboardingProgress, step: OnboardingStep): OnboardingProgress {
  return { ...progress, current: step, finished: false };
}

function firstIncomplete(completed: readonly OnboardingStep[]): OnboardingStep {
  return ONBOARDING_STEPS.find(step => !completed.includes(step)) ?? "cooking";
}
