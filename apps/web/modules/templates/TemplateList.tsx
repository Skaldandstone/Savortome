"use client";

import { useEffect, useState } from "react";
import type { MealTemplate } from "@seconds/core/format";
import { Panel, PanelHeader } from "@/ui";
import { api } from "@/lib/client";
import { TemplateItems } from "./TemplateItems";
import { TemplateShareControl } from "./TemplateShareControl";
import styles from "./templates.module.css";

/** Every meal you've saved — a main plus whichever side, drink, and dessert go with it. */
export function TemplateList() {
  const [templates, setTemplates] = useState<MealTemplate[] | null>(null);

  useEffect(() => {
    void api
      .myTemplates()
      .then((data) => setTemplates(data.templates))
      .catch(() => setTemplates([]));
  }, []);

  const remove = async (id: string) => {
    setTemplates((prev) => prev?.filter((t) => t.id !== id) ?? prev);
    try {
      await api.deleteTemplate(id);
    } catch {
      // The list already reflects the removal; a failed delete gets noticed
      // the next time this page loads, which is soon enough for a low-stakes
      // action with an undo-by-recreation available (save it again).
    }
  };

  return (
    <Panel>
      <PanelHeader
        title="Your meals"
        hint="A main plus whichever side, drink, and dessert you picked for it — saved from a recipe's own 'pairs well with' section."
      />

      {templates === null ? null : templates.length === 0 ? (
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
                <button type="button" className={styles.delete} onClick={() => void remove(template.id)}>
                  Delete
                </button>
              </div>
              <TemplateItems items={template.items} linkBase="/recipe" />
              <TemplateShareControl templateId={template.id} initialVisibility={template.visibility} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
