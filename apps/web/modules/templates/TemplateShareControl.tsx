"use client";

import { useEffect, useRef, useState } from "react";
import {
  VISIBILITIES,
  VISIBILITY_HELP,
  VISIBILITY_LABEL,
  templateShareUrl,
  type Visibility,
  type SecondsClient,
} from "@seconds/core/format";
import { Button, Callout } from "@/ui";
import { api } from "@/lib/client";
import styles from "../sharing/sharing.module.css";

/** Who can see this saved meal, and the link to hand someone — same shape as a recipe's. */
export function TemplateShareControl({
  templateId,
  initialVisibility,
  client = api,
  disabled = false,
  onPending,
  onReview,
}: {
  templateId: string;
  initialVisibility: Visibility;
  client?: SecondsClient;
  disabled?: boolean;
  onPending?: (pending: boolean) => void;
  onReview?: () => void;
}) {
  const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Visibility | null>(null);
  const alive = useRef(true); const action = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const link = typeof window === "undefined" ? "" : templateShareUrl(templateId, window.location.origin);

  async function change(next: Visibility) {
    if (action.current || (disabled && !pending)) return;
    const exact = pending ?? next;
    action.current = true; setPending(exact); onPending?.(true);
    setSaving(true);
    setError(null);
    try {
      const result = await client.setTemplateVisibility(templateId, exact);
      if (result.visibility !== exact) throw new Error("Unconfirmed");
      if (alive.current) { setVisibility(exact); setPending(null); onPending?.(false); }
    } catch {
      if (alive.current) setError("We could not confirm who can see this meal. The new setting may already be saved. The old selection is only the last confirmed setting. Retry the same setting; changing to private is not confirmed until the server responds.");
    } finally {
      if (alive.current) { action.current = false; setSaving(false); }
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
              disabled={disabled || saving || pending !== null}
              onClick={() => void change(option)}
            >
              {VISIBILITY_LABEL[option]}
            </Button>
          ))}
        </div>
      </div>

      <p className={styles.help}>{pending ? `Last confirmed setting: ${VISIBILITY_LABEL[visibility]}. Requested setting: ${VISIBILITY_LABEL[pending]}. Current access is unconfirmed.` : VISIBILITY_HELP[visibility]}</p>
      {pending ? <><Button variant="ghost" disabled={saving} onClick={() => void change(pending)}>{saving ? "Saving visibility…" : `Retry ${VISIBILITY_LABEL[pending]} setting`}</Button><p>Leaving this page loses local retry state and does not cancel the request. Reload saved meals to review access; an earlier write can still finish.</p></> : null}
      {pending && onReview ? <Button variant="ghost" disabled={saving} onClick={() => {
        if (action.current || !window.confirm("Discard only the local visibility retry and reload saved meals? This does not cancel or undo the earlier request, which may still finish. Review access again before making a different change.")) return;
        onReview();
      }}>Reload saved meals to review access</Button> : null}

      {visibility !== "private" && pending === null ? (
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
