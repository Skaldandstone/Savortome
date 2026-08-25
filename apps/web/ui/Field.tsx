import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import styles from "./Field.module.css";

export function TextField(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={styles.field} {...props} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${styles.field} ${styles.area}`} {...props} />;
}

export function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className={styles.row}>{children}</div>;
}
