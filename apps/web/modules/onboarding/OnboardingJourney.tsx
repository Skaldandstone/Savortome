"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ONBOARDING_STEPS,
  completeOnboardingStep,
  emptyOnboardingProgress,
  readOnboardingProgress,
  revisitOnboardingStep,
  type OnboardingProgress,
  type OnboardingStep,
} from "@seconds/core/onboarding";
import { Button, Callout, Panel } from "@/ui";
import { CookingProfilePanel } from "@/modules/cooking";
import { KitchenIcon } from "@/modules/woodland/KitchenIcon";
import styles from "./onboarding.module.css";

const GUEST_KEY = "savortome:onboarding:v1:guest";
const STEP_LABEL: Record<OnboardingStep, string> = {
  welcome: "Start with something useful",
  safety: "Food choices and safety",
  cooking: "Cooking at your pace",
};

export function OnboardingJourney({
  signedIn,
  storageScope,
}: {
  signedIn: boolean;
  storageScope: string;
}) {
  const storageKey = useMemo(() => `savortome:onboarding:v1:${storageScope}`, [storageScope]);
  const [progress, setProgress] = useState<OnboardingProgress>(emptyOnboardingProgress);
  const [ready, setReady] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    try {
      const own = localStorage.getItem(storageKey);
      const guest = signedIn ? localStorage.getItem(GUEST_KEY) : null;
      const loaded = readOnboardingProgress(own ?? guest);
      setProgress(loaded);
      if (!own && guest && storageKey !== GUEST_KEY) {
        localStorage.setItem(storageKey, JSON.stringify(loaded));
        localStorage.removeItem(GUEST_KEY);
      }
    } catch {
      // Storage can be unavailable in a locked-down browser. The guide still
      // works for this visit and makes no false claim that progress was saved.
    }
    setReady(true);
  }, [signedIn, storageKey]);

  function store(next: OnboardingProgress, message = "Progress saved on this device.") {
    setProgress(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setSaveMessage(message);
    } catch {
      setSaveMessage("This browser could not save your progress. You can still continue.");
    }
  }

  function finishStep(step: OnboardingStep) {
    store(completeOnboardingStep(progress, step));
  }

  if (!ready) {
    return <p className={styles.loading} role="status">Opening your getting-started guide…</p>;
  }

  if (progress.finished) {
    return (
      <Panel className={styles.finished}>
        <KitchenIcon name="sprig" />
        <h1>Your kitchen is ready when you are</h1>
        <p>You can change every choice later. Nothing here grades your cooking or expects you to finish a perfect setup.</p>
        <div className={styles.actions}>
          <Link className={styles.primaryLink} href="/">Open my recipe journal</Link>
          <Button type="button" variant="ghost" onClick={() => store(revisitOnboardingStep(progress, "welcome"), "Guide reopened.")}>Review this guide</Button>
        </div>
      </Panel>
    );
  }

  return (
    <>
      <nav className={styles.steps} aria-label="Getting started sections">
        {ONBOARDING_STEPS.map(step => (
          <button
            key={step}
            type="button"
            aria-current={progress.current === step ? "step" : undefined}
            data-complete={progress.completed.includes(step)}
            onClick={() => store(revisitOnboardingStep(progress, step), `${STEP_LABEL[step]} opened.`)}
          >
            <span aria-hidden="true">{progress.completed.includes(step) ? "✓" : "•"}</span>
            {STEP_LABEL[step]}
          </button>
        ))}
      </nav>

      {progress.current === "welcome" ? (
        <WelcomeStep signedIn={signedIn} onLeave={() => finishStep("welcome")} onContinue={() => finishStep("welcome")} />
      ) : null}
      {progress.current === "safety" ? (
        <SafetyStep signedIn={signedIn} onLeave={() => finishStep("safety")} onContinue={() => finishStep("safety")} />
      ) : null}
      {progress.current === "cooking" ? (
        <CookingStep signedIn={signedIn} onDone={() => finishStep("cooking")} />
      ) : null}

      {saveMessage ? <p className={styles.saveMessage} role="status">{saveMessage}</p> : null}
    </>
  );
}

function WelcomeStep({ signedIn, onLeave, onContinue }: StepProps & { signedIn: boolean }) {
  const signUpFor = (destination: string) => `/sign-up?redirect_url=${encodeURIComponent(destination)}`;
  return (
    <main className={styles.guide}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Welcome to Savortome</p>
          <h1>What would make food easier today?</h1>
          <p>Start with one useful thing. We will explain each choice when it becomes relevant, and you can skip the rest.</p>
        </div>
        <KitchenIcon name="book" />
      </header>

      <div className={styles.choices}>
        <GuideChoice
          href={signedIn ? "/recipe/new" : signUpFor("/recipe/new")}
          icon="book"
          title="Save a recipe"
          body={signedIn ? "Write one down or bring in a link." : "An account keeps your recipes private and available later."}
          onClick={onLeave}
        />
        <GuideChoice
          href={signedIn ? "/plan" : signUpFor("/plan")}
          icon="plan"
          title="Plan a meal"
          body={signedIn ? "Put one meal on the week and build from there." : "Sign in so a plan can be saved to your week."}
          onClick={onLeave}
        />
        <GuideChoice
          href="/care"
          icon="sprig"
          title="Feed me gently"
          body="Skip setup and begin with a few manageable food ideas. No cooking score or challenge language appears there."
          onClick={onLeave}
        />
      </div>

      <GuideFooter onContinue={onContinue} />
    </main>
  );
}

function SafetyStep({ signedIn, onLeave, onContinue }: StepProps & { signedIn: boolean }) {
  const profileHref = signedIn ? "/profile" : `/sign-up?redirect_url=${encodeURIComponent("/profile")}`;
  return (
    <main className={styles.guide}>
      <header className={styles.sectionHeader}>
        <p className={styles.eyebrow}>Food choices and safety</p>
        <h1>Tell us only what helps</h1>
        <p>Preferences steer suggestions. Allergens remove conflicts we can detect from ingredient names.</p>
      </header>
      <Callout tone="warn">
        Savortome cannot verify that a food is safe. Ingredient names can miss brands, substitutions, preparation, packaging, and cross-contact. Always check the food and its label.
      </Callout>
      <div className={styles.explainerGrid}>
        <section>
          <h2>Preferences</h2>
          <p>Use these to shape results toward the way you like to eat. Leaving them blank is completely fine.</p>
        </section>
        <section>
          <h2>Allergens</h2>
          <p>Selected allergens are hard filters when we personalize results. We never silently loosen them.</p>
        </section>
        <section>
          <h2>Your privacy</h2>
          <p>We do not ask for or infer a diagnosis, medication, neurotype, health history, or whether you ate a suggestion.</p>
        </section>
      </div>
      <div className={styles.actions}>
        <Link className={styles.primaryLink} href={profileHref} onClick={onLeave}>{signedIn ? "Set my food choices" : "Create an account to save choices"}</Link>
        <Button type="button" variant="ghost" onClick={onContinue}>I’ll do this later</Button>
        <Link href="/" onClick={onLeave}>Save and leave</Link>
      </div>
    </main>
  );
}

function CookingStep({ signedIn, onDone }: { signedIn: boolean; onDone: () => void }) {
  return (
    <main className={styles.guide}>
      <header className={styles.sectionHeader}>
        <p className={styles.eyebrow}>Cooking at your pace</p>
        <h1>Suggestions can meet you where you are</h1>
        <p>One cooking tier gives us a starting point. Skills and kitchen equipment are optional. These choices reorder ideas and explain possible Challenges; they never hide a recipe.</p>
      </header>
      {signedIn ? <CookingProfilePanel /> : (
        <Panel>
          <h2>Save this to your account</h2>
          <p>Sign in when you want Savortome to remember your cooking tier across devices. You can keep browsing without choosing one.</p>
          <Link className={styles.primaryLink} href={`/sign-up?redirect_url=${encodeURIComponent("/getting-started")}`}>Create an account</Link>
        </Panel>
      )}
      <div className={styles.actions}>
        <Button type="button" onClick={onDone}>Done for now</Button>
        <Link href="/">Save and leave</Link>
      </div>
      <p className={styles.careBoundary}>Feed me gently always stays separate from cooking tiers, equipment, and Challenges.</p>
    </main>
  );
}

function GuideChoice({ href, icon, title, body, onClick }: {
  href: string;
  icon: "book" | "plan" | "sprig";
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <Link className={styles.choice} href={href} onClick={onClick}>
      <KitchenIcon name={icon} />
      <span><strong>{title}</strong><small>{body}</small></span>
      <span aria-hidden="true">→</span>
    </Link>
  );
}

function GuideFooter({ onContinue }: { onContinue: () => void }) {
  return (
    <div className={styles.actions}>
      <Button type="button" onClick={onContinue}>Continue</Button>
      <Link href="/">Save and leave</Link>
    </div>
  );
}

type StepProps = { onLeave: () => void; onContinue: () => void };
