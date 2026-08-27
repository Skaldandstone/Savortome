"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SharedRecipeView } from "@seconds/core/format";
import { Button, Callout } from "@/ui";
import { api } from "@/lib/client";
import styles from "./sharing.module.css";

/**
 * The point of a shared link: getting the recipe into your own collection,
 * where you can shelve it, rate it, and shop for it.
 */
export function SaveSharedButton({ view }: { view: SharedRecipeView }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">(
    view.alreadySaved ? "saved" : "idle",
  );
  const [error, setError] = useState<string | null>(null);

  if (!view.canSave) {
    return view.alreadySaved ? (
      <p className={styles.savedNote}>This is already in your collection.</p>
    ) : (
      <Callout tone="info">
        <a href="/sign-in">Sign in</a> to save this to your own collection.
      </Callout>
    );
  }

  if (state === "saved") {
    return <p className={styles.savedNote}>Saved to your collection.</p>;
  }

  return (
    <div className={styles.saveRow}>
      <Button
        type="button"
        disabled={state === "saving"}
        onClick={async () => {
          setState("saving");
          setError(null);
          try {
            const { recipeId } = await api.saveSharedRecipe(view.recipeId);
            setState("saved");
            router.push(`/recipe/${recipeId}`);
          } catch (err) {
            setState("failed");
            setError(err instanceof Error ? err.message : "Couldn't save that.");
          }
        }}
      >
        {state === "saving" ? "Saving…" : "Save to my collection"}
      </Button>
      {error ? (
        <Callout tone="error" role="alert">
          {error}
        </Callout>
      ) : null}
    </div>
  );
}
