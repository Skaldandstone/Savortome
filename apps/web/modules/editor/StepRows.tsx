"use client";

import type { Step } from "@nomnom/core/format";
import { RowActions } from "./RowActions";
import styles from "./editor.module.css";

/** The method, one box per step. Numbering is positional and never typed. */
export function StepRows({
  steps,
  onReplace,
  onAdd,
  onRemove,
  onMove,
}: {
  steps: Step[];
  onReplace: (index: number, step: Step) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onMove: (from: number, to: number) => void;
}) {
  return (
    <div className={styles.rows}>
      {steps.map((step, index) => (
        <div className={styles.row} key={index}>
          <span className={styles.stepNumber} aria-hidden>
            {index + 1}
          </span>
          <textarea
            className={styles.stepInput}
            value={step.text}
            rows={2}
            placeholder="Heat the oil over medium heat until it shimmers."
            aria-label={`Step ${index + 1}`}
            onChange={(e) => onReplace(index, { ...step, text: e.target.value })}
          />
          <RowActions
            index={index}
            count={steps.length}
            label="step"
            onMove={onMove}
            onRemove={onRemove}
          />
        </div>
      ))}

      <button type="button" className={styles.addRow} onClick={onAdd}>
        + Add step
      </button>
    </div>
  );
}
