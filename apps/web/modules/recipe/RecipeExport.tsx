"use client";

import { useState } from "react";
import {
  exportFilename,
  recipeToMarkdown,
  recipeToText,
  type Ingredient,
  type Recipe,
} from "@seconds/core/format";
import styles from "./RecipeExport.module.css";

/**
 * Taking a recipe out of the app.
 *
 * Print is the one people actually reach for — a page propped against the
 * kettle doesn't lock, doesn't sleep and doesn't need a battery. The rest is
 * about the recipe not being trapped here: Markdown for a notes app, plain
 * text for a message, and the clipboard for everywhere else.
 *
 * All four export what's on screen rather than what's stored, so a recipe
 * scaled to six servings prints scaled to six.
 */
export function RecipeExport({
  recipe,
  ingredients,
  servings,
}: {
  recipe: Recipe;
  /** The scaled list, as shown. */
  ingredients: Ingredient[];
  servings: number | null;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");

  const options = { ingredients, servings };

  const download = (contents: string, extension: string, type: string) => {
    const url = URL.createObjectURL(new Blob([contents], { type: `${type};charset=utf-8` }));
    const link = document.createElement("a");
    link.href = url;
    link.download = exportFilename(recipe.title, extension);
    link.click();
    // The object URL pins the blob in memory, so it has to be let go of — but
    // not in this tick. Revoking synchronously after click() can cancel the
    // download before the browser has read the blob.
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(recipeToText(recipe, options));
      setCopyState("copied");
    } catch {
      // The clipboard can be refused outright, and unlike a share link there's
      // no copyable text on screen to fall back to — so say so rather than
      // looking like nothing happened.
      setCopyState("failed");
    }
    window.setTimeout(() => setCopyState("idle"), 2000);
  };

  return (
    <div className={styles.actions} data-print="hide">
      <button type="button" className={styles.action} onClick={() => window.print()}>
        Print
      </button>
      <button
        type="button"
        className={styles.action}
        onClick={() => download(recipeToMarkdown(recipe, options), "md", "text/markdown")}
      >
        Markdown
      </button>
      <button
        type="button"
        className={styles.action}
        onClick={() => download(recipeToText(recipe, options), "txt", "text/plain")}
      >
        Text file
      </button>
      <button type="button" className={styles.action} onClick={() => void copy()}>
        {copyState === "copied" ? "Copied" : copyState === "failed" ? "Couldn't copy" : "Copy"}
      </button>
    </div>
  );
}
