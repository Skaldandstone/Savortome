"use client";

import type { PersonSummary } from "@seconds/core/format";
import { Button } from "@/ui";
import styles from "./friends.module.css";

/** One person, with whatever actions make sense for how you stand with them. */
export function PersonRow({
  person,
  since,
  actions,
  disabled,
}: {
  person: PersonSummary;
  since?: string;
  actions: { label: string; onClick: () => void; primary?: boolean }[];
  disabled?: boolean;
}) {
  return (
    <li className={styles.person}>
      {person.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.avatar} src={person.avatarUrl} alt="" />
      ) : (
        <span className={styles.avatarBlank} aria-hidden="true">
          {person.displayName.slice(0, 1).toUpperCase()}
        </span>
      )}

      <span className={styles.personText}>
        <strong>{person.displayName}</strong>
        <br />
        <span className={styles.handle}>@{person.handle}</span>
        {since ? <span className={styles.since}> · {since}</span> : null}
      </span>

      <span className={styles.personActions}>
        {actions.map((action) => (
          <Button
            key={action.label}
            variant={action.primary ? "primary" : "ghost"}
            type="button"
            disabled={disabled}
            onClick={action.onClick}
          >
            {action.label}
          </Button>
        ))}
      </span>
    </li>
  );
}
