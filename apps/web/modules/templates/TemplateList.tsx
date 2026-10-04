"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { createClient, type MealTemplate, type SecondsClient } from "@seconds/core/format";
import { Button, Callout, Panel, PanelHeader } from "@/ui";
import { TemplateItems } from "./TemplateItems";
import { TemplateShareControl } from "./TemplateShareControl";
import styles from "./templates.module.css";

/** Every meal you've saved — a main plus whichever side, drink, and dessert go with it. */
export function TemplateList({ clerkEnabled = true }: { clerkEnabled?: boolean }) {
  return clerkEnabled ? <AuthenticatedTemplates /> : <AccountTemplateList />;
}
function AuthenticatedTemplates() {
  const { isLoaded, userId, sessionId } = useAuth();
  if (!isLoaded) return <p role="status">Loading sign-in for saved meals…</p>;
  if (!userId || !sessionId) return <p><Link href="/sign-in?redirect_url=%2Ftemplates">Sign in again</Link> to load your saved meals.</p>;
  return <AccountTemplateList key={sessionId} sessionId={sessionId} />;
}
function AccountTemplateList({ sessionId }: { sessionId?: string }) {
  const api: SecondsClient = useMemo(() => createClient({ expectedSessionId: sessionId }), [sessionId]);
  const alive = useRef(true); const action = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const [templates, setTemplates] = useState<MealTemplate[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [unconfirmedDelete, setUnconfirmedDelete] = useState<string | null>(null);
  const [sharePending, setSharePending] = useState<Record<string, boolean>>({});
  const locked = deleting !== null || unconfirmedDelete !== null || Object.values(sharePending).some(Boolean);

  useEffect(() => {
    let active = true;
    setTemplates(null);
    setLoadError(false);
    void api
      .myTemplates()
      .then((data) => { if (active) setTemplates(data.templates); })
      .catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [loadAttempt, api]);

  const remove = async (template: MealTemplate) => {
    if (action.current || locked) return;
    action.current = true; setUnconfirmedDelete(template.id);
    setDeleting(template.id);
    setMessage("");
    try {
      const result = await api.deleteTemplate(template.id);
      if (result.ok !== true) throw new Error("Unconfirmed");
      if (!alive.current) return;
      setTemplates((prev) => prev?.filter((saved) => saved.id !== template.id) ?? prev);
      setConfirmingDelete(null);
      setMessage(`${template.name} was deleted.`);
      setUnconfirmedDelete(null);
    } catch {
      if (alive.current) setMessage(`We could not confirm deletion of ${template.name}. It may already be deleted. Reload saved meals before deciding; nothing retries automatically.`);
    } finally {
      if (alive.current) { action.current = false; setDeleting(null); }
    }
  };

  return (
    <Panel>
      <PanelHeader
        title="Your meals"
        hint="A main plus whichever side, drink, and dessert you picked for it — saved from a recipe's own 'pairs well with' section."
      />

      {loadError ? (
        <Callout tone="warn" title="Saved meals could not load" role="alert">
          <div className={styles.loadError}>
            <span>Your saved meals have not been changed. Try again before deciding that this list is empty.</span>
            <Button type="button" variant="ghost" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Try again</Button>
          </div>
        </Callout>
      ) : templates === null ? (
        <p className={styles.empty} role="status">Loading saved meals…</p>
      ) : templates.length === 0 ? (
        <p className={styles.empty}>
          Nothing saved yet. Pick a side, drink, or dessert on a recipe's page, then save the
          combination as a meal.
        </p>
      ) : (
        <ul className={styles.list}>
          {templates.map((template) => (
            <li key={template.id} className={styles.card}>
              <div className={styles.head}>
                <h3 className={styles.name}>{template.name}</h3>
                <button
                  type="button"
                  className={styles.delete}
                  aria-label={`Delete ${template.name}`}
                  aria-expanded={confirmingDelete === template.id}
                  disabled={locked}
                  onClick={() => { setMessage(""); setConfirmingDelete(template.id); }}
                >
                  Delete
                </button>
              </div>
              <TemplateItems items={template.items} linkBase="/recipe" />
              <TemplateShareControl templateId={template.id} initialVisibility={template.visibility} client={api} disabled={locked} onPending={pending => setSharePending(current => ({ ...current, [template.id]: pending }))} onReview={() => {
                if (action.current) return;
                setSharePending({}); setConfirmingDelete(null); setLoadAttempt(value => value + 1);
                setMessage("Reloading to review unconfirmed access. Earlier requests are not cancelled and may still finish. Recheck visibility before sharing a link or making another change.");
              }} />
              {confirmingDelete === template.id ? (
                <Callout tone="warn" title={`Delete ${template.name}?`}>
                  <p>This removes the saved meal and stops its shared link from working. Its recipes stay in your journal.</p>
                  <div className={styles.actions}>
                    <Button type="button" variant="danger" disabled={locked} onClick={() => void remove(template)}>
                      {deleting === template.id ? "Deleting…" : "Delete saved meal"}
                    </Button>
                    <Button type="button" variant="ghost" disabled={deleting === template.id} onClick={() => setConfirmingDelete(null)}>Keep it</Button>
                  </div>
                </Callout>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {message ? <p className={styles.message} role="status">{message}</p> : null}
      {unconfirmedDelete && deleting === null ? <Button variant="ghost" onClick={() => {
        if (action.current) return;
        setUnconfirmedDelete(null); setConfirmingDelete(null); setLoadAttempt(value => value + 1);
        setMessage("Reloading the collection to review the unconfirmed deletion. This does not undo or cancel the earlier request; check again before deleting another meal.");
      }}>Reload saved meals to review deletion</Button> : null}
    </Panel>
  );
}
