import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import styles from "./Field.module.css";

export function TextField({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={[styles.field, className].filter(Boolean).join(' ')} {...props} />;
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={[styles.field, styles.area, className].filter(Boolean).join(' ')} {...props} />;
}

export function FieldRow({ children }: { children: React.ReactNode }) {
  return <div className={styles.row}>{children}</div>;
}
