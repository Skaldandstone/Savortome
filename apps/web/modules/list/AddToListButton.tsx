"use client";

import { useState } from "react";
import { Button } from "@/ui";
import { api } from "@/lib/client";

/**
 * Puts a recipe's ingredients on the list. Lives on the recipe card, where the
 * decision to cook something is actually made.
 */
export function AddToListButton({ recipeId }: { recipeId: string | null }) {
  const [state, setState] = useState<"idle" | "saving" | "added" | "failed">("idle");

  if (!recipeId) return null;

  const label =
    state === "saving" ? "Adding…" : state === "added" ? "On your list ✓" : state === "failed" ? "Try again" : "Add to shopping list";

  return (
    <Button
      variant="ghost"
      type="button"
      disabled={state === "saving"}
      onClick={async () => {
        setState("saving");
        try {
          await api.addRecipesToList([recipeId]);
          setState("added");
        } catch {
          setState("failed");
        }
      }}
    >
      {label}
    </Button>
  );
}

/** Adds just the ingredients a pantry match said were missing. */
export function AddMissingButton({
  missing,
  onAdded,
}: {
  missing: string[];
  onAdded?: () => void;
}) {
  const [state, setState] = useState<"idle" | "saving" | "added" | "failed">("idle");

  if (missing.length === 0) return null;

  const label =
    state === "saving"
      ? "Adding…"
      : state === "added"
        ? "Added ✓"
        : state === "failed"
          ? "Try again"
          : `Add ${missing.length} missing`;

  return (
    <Button
      variant="ghost"
      type="button"
      disabled={state === "saving"}
      onClick={async (e) => {
        // The row is a link to the recipe; adding to the list is not navigation.
        e.preventDefault();
        e.stopPropagation();
        setState("saving");
        try {
          await api.addItemsToList(missing.map((canonicalItem) => ({ canonicalItem })));
          setState("added");
          onAdded?.();
        } catch {
          setState("failed");
        }
      }}
    >
      {label}
    </Button>
  );
}
