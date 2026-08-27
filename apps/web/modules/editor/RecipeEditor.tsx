"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { RecipeDraft } from "@seconds/core/format";
import { api } from "@/lib/client";
import { Button, Callout, Panel, PanelHeader } from "@/ui";
import { Basics, Details } from "./DetailFields";
import { IngredientRows } from "./IngredientRows";
import { StepRows } from "./StepRows";
import { useDraft } from "./useDraft";
import styles from "./editor.module.css";

/**
 * Writing a recipe, and fixing one.
 *
 * The same form does both. A recipe typed by hand and a recipe pulled out of a
 * video are the same thing once they're on the page, and the moment you correct
 * an imported card it stops being a guess — so saving an edit is also what
 * marks it as checked by a person.
 */
export function RecipeEditor({
  initial,
  recipeId = null,
}: {
  initial: RecipeDraft;
  /** Null when writing a new recipe. */
  recipeId?: string | null;
}) {
  const { draft, dirty, set, ingredients, steps } = useDraft(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const router = useRouter();

  // Losing a recipe you just typed out is unforgivable, and the browser's own
  // prompt is the only thing that can interrupt a tab close.
  useEffect(() => {
    if (!dirty || leaving) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, leaving]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const savedId = recipeId ?? (await api.createRecipe(draft)).recipeId;
      if (recipeId) await api.updateRecipe(recipeId, draft);

      setLeaving(true);
      router.push(`/recipe/${savedId}`);
      // The recipe page renders on the server, so it has to be told the row moved.
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!recipeId) return;
    setSaving(true);
    try {
      await api.deleteRecipe(recipeId);
      setLeaving(true);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete that.");
      setSaving(false);
    }
  };

  return (
    <form
      className={styles.editor}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Panel>
        <PanelHeader
          title={recipeId ? "Edit recipe" : "Write a recipe"}
          hint={
            recipeId
              ? "Saving marks this card as checked, so it stops asking to be reviewed."
              : "Only the name, one ingredient, and one step are required."
          }
        />
        <Basics draft={draft} set={set} />
      </Panel>

      <Panel>
        <PanelHeader
          title="Ingredients"
          hint="One per line, however you'd write it down. End a line with a colon to start a section."
        />
        <IngredientRows
          ingredients={draft.ingredients}
          onReplace={ingredients.replace}
          onAdd={ingredients.add}
          onAddHeading={ingredients.addHeading}
          onRemove={ingredients.remove}
          onMove={ingredients.move}
        />
      </Panel>

      <Panel>
        <PanelHeader title="Method" />
        <StepRows
          steps={draft.steps}
          onReplace={steps.replace}
          onAdd={steps.add}
          onRemove={steps.remove}
          onMove={steps.move}
        />
      </Panel>

      <Panel>
        <PanelHeader title="Details" hint="All optional, and all of it makes the recipe easier to find later." />
        <Details draft={draft} set={set} />
      </Panel>

      {error ? (
        <Callout tone="error" role="alert">
          {error}
        </Callout>
      ) : null}

      <div className={styles.actions}>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : recipeId ? "Save changes" : "Save recipe"}
        </Button>

        <Link className={styles.cancel} href={recipeId ? `/recipe/${recipeId}` : "/"}>
          Cancel
        </Link>

        {recipeId ? (
          <div className={styles.danger}>
            {confirmingDelete ? (
              <>
                <span className={styles.hint}>Delete this recipe for good?</span>
                <Button type="button" variant="ghost" onClick={() => void remove()}>
                  Yes, delete it
                </Button>
                <Button type="button" variant="ghost" onClick={() => setConfirmingDelete(false)}>
                  Keep it
                </Button>
              </>
            ) : (
              <Button type="button" variant="ghost" onClick={() => setConfirmingDelete(true)}>
                Delete
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </form>
  );
}
