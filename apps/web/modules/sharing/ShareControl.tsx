"use client";

import { useState } from "react";
import {
  VISIBILITIES,
  VISIBILITY_HELP,
  VISIBILITY_LABEL,
  shareUrl,
  type Visibility,
} from "@nomnom/core/format";
import { Button, Callout } from "@/ui";
import { api } from "@/lib/client";
import styles from "./sharing.module.css";

/**
 * Who can see this recipe, and the link to hand someone.
 *
 * The link is shown as soon as the recipe leaves private, because "I changed a
 * setting" and "I have something to send" are the same moment.
 */
export function ShareControl({
  recipeId,
  initialVisibility,
}: {
  recipeId: string | null;
  initialVisibility: Visibility;
}) {
  const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!recipeId) return null;

  const link = typeof window === "undefined" ? "" : shareUrl(recipeId, window.location.origin);

  async function change(next: Visibility) {
    const previous = visibility;
    setVisibility(next);
    setSaving(true);
    setError(null);
    try {
      const result = await api.setVisibility(recipeId!, next);
      if (result.visibility === null) throw new Error("That recipe isn't yours to share.");
      setVisibility(result.visibility);
    } catch (err) {
      setVisibility(previous);
      setError(err instanceof Error ? err.message : "Couldn't change that.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.share} aria-label="Sharing">
      <div className={styles.row}>
        <h3 className={styles.label}>Sharing</h3>
        <div className={styles.options}>
          {VISIBILITIES.map((option) => (
            <Button
              key={option}
              variant="toggle"
              type="button"
              aria-pressed={visibility === option}
              disabled={saving}
              onClick={() => void change(option)}
            >
              {VISIBILITY_LABEL[option]}
            </Button>
          ))}
        </div>
      </div>

      <p className={styles.help}>{VISIBILITY_HELP[visibility]}</p>

      {visibility !== "private" ? (
        <div className={styles.linkRow}>
          <code className={styles.link}>{link}</code>
          <Button
            variant="ghost"
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                // Clipboard can be refused; the link is on screen either way.
              }
            }}
          >
            {copied ? "Copied ✓" : "Copy link"}
          </Button>
        </div>
      ) : null}

      {error ? (
        <Callout tone="error" role="alert">
          {error}
        </Callout>
      ) : null}
    </section>
  );
}
