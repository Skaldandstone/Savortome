"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { RecipeDraft } from "@seconds/core/format";
import { api } from "@/lib/client";
import { actionFailure, signInReturnHref, type ActionFailure } from "@/lib/action-failure";
import { Button, Callout, Panel, PanelHeader } from "@/ui";
import { Basics, Details } from "./DetailFields";
import { IngredientRows } from "./IngredientRows";
import { StepRows } from "./StepRows";
import { readRecipeDraftRecovery, recipeDraftStorageKey } from "./draft-recovery";
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
  storageScope,
}: {
  initial: RecipeDraft;
  /** Null when writing a new recipe. */
  recipeId?: string | null;
  /** Opaque per-account scope. Never use a Clerk id or email here. */
  storageScope: string;
}) {
  const { draft, dirty, restore, set, ingredients, steps } = useDraft(initial);
  const [error, setError] = useState<ActionFailure | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [recoverable, setRecoverable] = useState<RecipeDraft | null>(null);
  const [draftStatus, setDraftStatus] = useState("");
  const router = useRouter();
  const storageKey = useMemo(
    () => recipeDraftStorageKey(storageScope, recipeId),
    [recipeId, storageScope],
  );

  useEffect(() => {
    setRecoverable(null);
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (!stored) return;
      const recovered = readRecipeDraftRecovery(stored);
      if (recovered) setRecoverable(recovered);
      else sessionStorage.removeItem(storageKey);
    } catch {
      // A blocked or malformed session store must never block the editor.
    }
  }, [storageKey]);

  useEffect(() => {
    if (!dirty || leaving) return;
    const timer = window.setTimeout(() => {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify({ draft, savedAt: Date.now() }));
        setDraftStatus("Draft kept in this tab.");
      } catch {
        setDraftStatus("This browser could not keep a recovery draft. Save the recipe before leaving.");
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [dirty, draft, leaving, storageKey]);

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

      try { sessionStorage.removeItem(storageKey); } catch { /* Saving still succeeded. */ }
      setLeaving(true);
      router.push(`/recipe/${savedId}`);
      // The recipe page renders on the server, so it has to be told the row moved.
      router.refresh();
    } catch (err) {
      setError(actionFailure(err, "Couldn't save that."));
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!recipeId) return;
    setSaving(true);
    try {
      await api.deleteRecipe(recipeId);
      try { sessionStorage.removeItem(storageKey); } catch { /* Deleting still succeeded. */ }
      setLeaving(true);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(actionFailure(err, "Couldn't delete that."));
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
      {recoverable ? (
        <Callout tone="info" title="You have unfinished changes from this tab" role="status">
          <p>Bring them back, or discard them and keep the saved version shown here.</p>
          <div className={styles.recoveryActions}>
            <Button type="button" onClick={() => {
              restore(recoverable);
              setRecoverable(null);
              setDraftStatus("Recovery draft restored.");
            }}>Restore my changes</Button>
            <Button type="button" variant="ghost" onClick={() => {
              try { sessionStorage.removeItem(storageKey); } catch { /* The editor remains usable. */ }
              setRecoverable(null);
              setDraftStatus("Recovery draft discarded.");
            }}>Use the saved version</Button>
          </div>
        </Callout>
      ) : null}

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
          {error.message}
          {error.signInRequired ? <> <Link href={signInReturnHref(recipeId ? `/recipe/${recipeId}/edit` : "/recipe/new")}>Sign in again</Link>. Your recovery draft will remain in this tab.</> : null}
        </Callout>
      ) : null}

      {draftStatus ? <p className={styles.draftStatus} role="status">{draftStatus}</p> : null}

      <div className={styles.actions}>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : recipeId ? "Save changes" : "Save recipe"}
        </Button>

        <Link className={styles.cancel} href={recipeId ? `/recipe/${recipeId}` : "/"}>
          Leave and keep draft
        </Link>

        {recipeId ? (
          <div className={styles.danger}>
            {confirmingDelete ? (
              <>
                <span className={styles.hint}>Delete this recipe for good?</span>
                <Button type="button" variant="danger" onClick={() => void remove()}>
                  Yes, delete it
                </Button>
                <Button type="button" variant="ghost" onClick={() => setConfirmingDelete(false)}>
                  Keep it
                </Button>
              </>
            ) : (
              <Button type="button" variant="danger" onClick={() => setConfirmingDelete(true)}>
                Delete
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </form>
  );
}
