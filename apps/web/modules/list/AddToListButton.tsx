"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isUuid } from "@seconds/core/format";
import { Button } from "@/ui";
import { api } from "@/lib/client";

/**
 * Puts a recipe's ingredients on the list. Lives on the recipe card, where the
 * decision to cook something is actually made.
 */
export function AddToListButton({ recipeId }: { recipeId: string | null }) {
  if (!isUuid(recipeId)) return null;
  return <RecipeAddButton key={recipeId} recipeId={recipeId} />;
}

function RecipeAddButton({ recipeId }: { recipeId: string }) {
  const [state, setState] = useState<"idle" | "saving" | "review" | "failed">("idle");
  const [message, setMessage] = useState("");
  const stage = useRef<"idle" | "saving" | "review" | "failed">("idle");
  const alive = useRef(true);
  const router = useRouter();
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const label = state === "saving" ? "Adding…" : state === "review" ? "Review shopping list" : state === "failed" ? "Check shopping list" : "Add to shopping list";
  return <span>
    <Button variant="ghost" type="button" disabled={state === "saving"} aria-busy={state === "saving"}
      onClick={async event => {
        event.preventDefault(); event.stopPropagation();
        if (!alive.current || stage.current === "saving") return;
        if (stage.current !== "idle") { router.push("/list"); return; }
        stage.current = "saving"; setState("saving"); setMessage("");
        try {
          const result = await api.addRecipesToList([recipeId]);
          if (!result || !isUuid(result.id) || !Array.isArray(result.items) || result.items.some(item =>
            !item || !isUuid(item.id) || typeof item.canonicalItem !== "string" || !item.canonicalItem.trim() ||
            (item.quantity !== null && (typeof item.quantity !== "number" || !Number.isFinite(item.quantity))) ||
            (item.unit !== null && typeof item.unit !== "string") || typeof item.checked !== "boolean" ||
            !Array.isArray(item.recipeIds) || !item.recipeIds.every(isUuid)
          )) throw new Error("Unconfirmed shopping list");
          if (!alive.current) return;
          stage.current = "review"; setState("review");
          setMessage("Shopping-list request completed. Review your list and amounts; pantry, staple or optional-item settings may leave ingredients off. No groceries were ordered or pantry stock consumed.");
        } catch {
          if (!alive.current) return;
          stage.current = "failed"; setState("failed");
          setMessage("This addition is unconfirmed and may still finish. Check your shopping list and amounts before adding again. Nothing retries automatically; leaving this recipe loses the local warning.");
        }
      }}>{label}</Button>
    {message ? <span role="status">{message}</span> : null}
  </span>;
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
