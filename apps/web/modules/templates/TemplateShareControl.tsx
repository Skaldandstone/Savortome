"use client";

import { useState } from "react";
import {
  VISIBILITIES,
  VISIBILITY_HELP,
  VISIBILITY_LABEL,
  templateShareUrl,
  type Visibility,
} from "@seconds/core/format";
import { Button, Callout } from "@/ui";
import { api } from "@/lib/client";
import styles from "../sharing/sharing.module.css";

/** Who can see this saved meal, and the link to hand someone — same shape as a recipe's. */
export function TemplateShareControl({
  templateId,
  initialVisibility,
}: {
  templateId: string;
  initialVisibility: Visibility;
}) {
  const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const link = typeof window === "undefined" ? "" : templateShareUrl(templateId, window.location.origin);

  async function change(next: Visibility) {
    const previous = visibility;
    setVisibility(next);
    setSaving(true);
    setError(null);
    try {
      const result = await api.setTemplateVisibility(templateId, next);
      if (result.visibility === null) throw new Error("That meal isn't yours to share.");
      setVisibility(result.visibility);
    } catch (err) {
      setVisibility(previous);
      setError(err instanceof Error ? err.message : "Couldn't change that.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className={styles.row}>
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
    </div>
  );
}
