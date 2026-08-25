import { IMPORT_STAGES } from "@nomnom/core/format";
import styles from "./import.module.css";

export function ImportProgress({ stage }: { stage: number }) {
  return (
    <div className={styles.progress} role="status" aria-live="polite">
      <ol className={styles.stages}>
        {IMPORT_STAGES.map((label, i) => (
          <li key={label} data-state={i < stage ? "done" : i === stage ? "active" : "pending"}>
            {label}
          </li>
        ))}
      </ol>
    </div>
  );
}
