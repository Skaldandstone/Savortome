import type { ReactNode } from "react";
import styles from "./Panel.module.css";

/** The raised card surface every section of the app sits on. */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={[styles.panel, className].filter(Boolean).join(" ")}>{children}</section>;
}

export function PanelHeader({ title, hint }: { title: string; hint?: ReactNode }) {
  return (
    <header className={styles.header}>
      <h2 className={styles.title}>{title}</h2>
      {hint ? <p className={styles.hint}>{hint}</p> : null}
    </header>
  );
}
