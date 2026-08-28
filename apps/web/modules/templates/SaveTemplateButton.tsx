"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SharedTemplateView } from "@seconds/core/format";
import { Button, Callout } from "@/ui";
import { api } from "@/lib/client";
import styles from "../sharing/sharing.module.css";

/** The point of a shared meal's link: copying the whole thing into your own library. */
export function SaveTemplateButton({ view }: { view: SharedTemplateView }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!view.canSave) {
    return (
      <Callout tone="info">
        <a href="/sign-in">Sign in</a> to save this meal to your own library.
      </Callout>
    );
  }

  if (state === "saved") {
    return <p className={styles.savedNote}>Saved to your library.</p>;
  }

  return (
    <div className={styles.saveRow}>
      <Button
        type="button"
        disabled={state === "saving" || view.items.length === 0}
        onClick={async () => {
          setState("saving");
          setError(null);
          try {
            await api.saveSharedTemplate(view.id);
            setState("saved");
            router.push("/templates");
          } catch (err) {
            setState("failed");
            setError(err instanceof Error ? err.message : "Couldn't save that.");
          }
        }}
      >
        {state === "saving" ? "Saving…" : "Save this meal"}
      </Button>
      {error ? (
        <Callout tone="error" role="alert">
          {error}
        </Callout>
      ) : null}
    </div>
  );
}
