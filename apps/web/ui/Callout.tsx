import type { ReactNode } from "react";
import styles from "./Callout.module.css";

export type CalloutTone = "info" | "warn" | "error";

/**
 * Short block of consequence: an error, a caveat, or a note about how much of
 * a recipe we had to infer.
 */
export function Callout({
  tone = "info",
  title,
  children,
  role,
}: {
  tone?: CalloutTone;
  title?: ReactNode;
  children: ReactNode;
  role?: "alert" | "status";
}) {
  return (
    <div className={`${styles.callout} ${styles[tone]}`} role={role}>
      {title ? <strong className={styles.title}>{title}</strong> : null}
      {children}
    </div>
  );
}
