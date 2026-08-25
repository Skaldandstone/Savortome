import { Button } from "@/ui";
import styles from "./import.module.css";
import type { ImportMode } from "@nomnom/core/format";

const MODES: { value: ImportMode; label: string }[] = [
  { value: "url", label: "From a link" },
  { value: "text", label: "Paste text" },
];

export function ModeSwitch({
  mode,
  onChange,
}: {
  mode: ImportMode;
  onChange: (mode: ImportMode) => void;
}) {
  return (
    <div className={styles.modeSwitch} role="group" aria-label="Import source">
      {MODES.map(({ value, label }) => (
        <Button
          key={value}
          variant="toggle"
          type="button"
          aria-pressed={mode === value}
          onClick={() => onChange(value)}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
