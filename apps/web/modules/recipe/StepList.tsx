import { timestampUrl, type Recipe, type Step } from "@nomnom/core/format";
import styles from "./StepList.module.css";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

const formatTimer = (seconds: number) =>
  seconds < 90 ? `${seconds}s` : `${Math.round(seconds / 60)} min`;

function StepMeta({ step, source }: { step: Step; source: Recipe["source"] }) {
  const link = step.sourceTimestamp !== null ? timestampUrl(source, step.sourceTimestamp) : null;
  if (!link && !step.timerSeconds) return null;

  return (
    <div className={styles.meta}>
      {link ? (
        <a className={styles.jump} href={link} target="_blank" rel="noreferrer noopener">
          ▶ {mmss(step.sourceTimestamp as number)}
        </a>
      ) : null}
      {step.timerSeconds ? <span>⏱ {formatTimer(step.timerSeconds)}</span> : null}
    </div>
  );
}

export function StepList({ steps, source }: { steps: Step[]; source: Recipe["source"] }) {
  return (
    <ol className={styles.steps}>
      {steps.map((step) => (
        <li key={step.n} className={styles.step}>
          {step.text}
          <StepMeta step={step} source={source} />
        </li>
      ))}
    </ol>
  );
}
