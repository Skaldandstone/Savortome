"use client";

import { useEffect, useState } from "react";
import type { MealTemplate } from "@seconds/core/format";
import { Button, Callout, Panel, PanelHeader } from "@/ui";
import { api } from "@/lib/client";
import { TemplateItems } from "./TemplateItems";
import { TemplateShareControl } from "./TemplateShareControl";
import styles from "./templates.module.css";

/** Every meal you've saved — a main plus whichever side, drink, and dessert go with it. */
export function TemplateList() {
  const [templates, setTemplates] = useState<MealTemplate[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    setTemplates(null);
    setLoadError(false);
    void api
      .myTemplates()
      .then((data) => { if (active) setTemplates(data.templates); })
      .catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [loadAttempt]);

  const remove = async (template: MealTemplate) => {
    setDeleting(template.id);
    setMessage("");
    try {
      await api.deleteTemplate(template.id);
      setTemplates((prev) => prev?.filter((saved) => saved.id !== template.id) ?? prev);
      setConfirmingDelete(null);
      setMessage(`${template.name} was deleted.`);
    } catch {
      setMessage(`${template.name} could not be deleted. It is still saved; try again when the connection returns.`);
    } finally {
      setDeleting(null);
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
                  onClick={() => { setMessage(""); setConfirmingDelete(template.id); }}
                >
                  Delete
                </button>
              </div>
              <TemplateItems items={template.items} linkBase="/recipe" />
              <TemplateShareControl templateId={template.id} initialVisibility={template.visibility} />
              {confirmingDelete === template.id ? (
                <Callout tone="warn" title={`Delete ${template.name}?`}>
                  <p>This removes the saved meal and stops its shared link from working. Its recipes stay in your journal.</p>
                  <div className={styles.actions}>
                    <Button type="button" variant="danger" disabled={deleting === template.id} onClick={() => void remove(template)}>
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
    </Panel>
  );
}
