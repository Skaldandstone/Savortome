"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { createClient, isUuid } from "@seconds/core/format";
import { Button } from "@/ui";
import { api as localApi } from "@/lib/client";

/**
 * Puts a recipe's ingredients on the list. Lives on the recipe card, where the
 * decision to cook something is actually made.
 */
export function AddToListButton({ recipeId, clerkEnabled = true }: { recipeId: string | null; clerkEnabled?: boolean }) {
  if (!isUuid(recipeId)) return null;
  return clerkEnabled ? <AuthenticatedRecipeAddition recipeId={recipeId} /> : <RecipeAddButton key={recipeId} recipeId={recipeId} api={localApi} />;
}

function AuthenticatedRecipeAddition({ recipeId }: { recipeId: string }) {
  const { userId, sessionId, isLoaded } = useAuth();
  const api = useMemo(() => createClient({ expectedSessionId: sessionId ?? "signed-out" }), [userId, sessionId]);
  if (!isLoaded) return <span role="status">Loading shopping actions.</span>;
  if (!userId || !sessionId) return <span role="status">Sign in again before adding to your shopping list.</span>;
  return <RecipeAddButton key={recipeId} recipeId={recipeId} api={api} />;
}

function RecipeAddButton({ recipeId, api }: { recipeId: string; api: typeof localApi }) {
  const [state, setState] = useState<"idle" | "saving" | "review" | "failed">("idle");
  const [message, setMessage] = useState("");
  const stage = useRef<"idle" | "saving" | "review" | "failed">("idle");
  const alive = useRef(true);
  const activeClient = useRef(api); activeClient.current = api;
  const dataClient = useRef(api);
  const active = () => alive.current && activeClient.current === api;
  const router = useRouter();
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    dataClient.current = api;
    stage.current = "idle"; setState("idle"); setMessage("");
  }, [api]);
  if (dataClient.current !== api) return <span role="status">Updating shopping actions for your sign-in.</span>;
  const label = state === "saving" ? "Adding…" : state === "review" ? "Review shopping list" : state === "failed" ? "Check shopping list" : "Add to shopping list";
  return <span>
    <Button variant="ghost" type="button" disabled={state === "saving"} aria-busy={state === "saving"}
      onClick={async event => {
        event.preventDefault(); event.stopPropagation();
        if (!active() || stage.current === "saving") return;
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
          if (!active()) return;
          stage.current = "review"; setState("review");
          setMessage("Shopping-list request completed. Review your list and amounts; pantry, staple or optional-item settings may leave ingredients off. No groceries were ordered or pantry stock consumed.");
        } catch {
          if (!active()) return;
          stage.current = "failed"; setState("failed");
          setMessage("This addition is unconfirmed and may still finish. Check your shopping list and amounts before adding again. Nothing retries automatically; leaving this recipe loses the local warning.");
        }
      }}>{label}</Button>
    {message ? <span role="status">{message}</span> : null}
  </span>;
}

/** Adds ingredient names only; quantities must be reviewed in the list. */
export function AddMissingButton({
  api = localApi,
  missing,
  onAdded,
}: {
  api?: typeof localApi;
  missing: string[];
  onAdded?: () => void;
}) {
  const [state, setState] = useState<"idle" | "saving" | "review" | "failed">("idle");
  const [message, setMessage] = useState("");
  const stage = useRef<"idle" | "saving" | "review" | "failed">("idle");
  const alive = useRef(true);
  const activeClient = useRef(api); activeClient.current = api;
  const dataClient = useRef(api);
  const active = () => alive.current && activeClient.current === api;
  const names = [...new Set(missing.map(name => name.trim()).filter(Boolean))];
  const selection = JSON.stringify(names);
  const current = useRef({ selection, onAdded });
  current.current = { selection, onAdded };
  const router = useRouter();
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  useEffect(() => {
    dataClient.current = api;
    stage.current = "idle"; setState("idle"); setMessage("");
  }, [api]);
  if (dataClient.current !== api) return <span role="status">Updating shopping actions for your sign-in.</span>;

  // Retain pending/completed uncertainty even if a refreshed match has no gaps.
  if (names.length === 0 && state === "idle") return null;
  const label = state === "saving" ? "Adding…" : state === "review" ? "Review shopping list" : state === "failed" ? "Check shopping list" : `Add ${names.length} missing`;
  return <span>
    <Button variant="ghost" type="button" disabled={state === "saving"} aria-busy={state === "saving"}
      onClick={async event => {
        event.preventDefault(); event.stopPropagation();
        if (!active() || stage.current === "saving") return;
        if (stage.current !== "idle") { router.push("/list"); return; }
        if (!names.length || current.current.selection !== selection) return;
        stage.current = "saving"; setState("saving"); setMessage("");
        try {
          const result = await api.addItemsToList(names.map(canonicalItem => ({ canonicalItem })));
          if (!result || !isUuid(result.id) || !Array.isArray(result.items) || result.items.some(item =>
            !item || !isUuid(item.id) || typeof item.canonicalItem !== "string" || !item.canonicalItem.trim() ||
            (item.quantity !== null && (typeof item.quantity !== "number" || !Number.isFinite(item.quantity))) ||
            (item.unit !== null && typeof item.unit !== "string") || typeof item.checked !== "boolean" ||
            !Array.isArray(item.recipeIds) || !item.recipeIds.every(isUuid)
          ) || !names.every(name => result.items.some(item => item.canonicalItem === name))) throw new Error("Unconfirmed shopping list");
          if (!active()) return;
          stage.current = "review"; setState("review");
          setMessage("The requested ingredient names appear on your shopping list. Review amounts and checked items. No groceries were ordered or pantry stock consumed.");
        } catch {
          if (!active()) return;
          stage.current = "failed"; setState("failed");
          setMessage("This addition is unconfirmed and may still finish. Check your shopping list before adding again. Nothing retries automatically; leaving this page loses the local warning.");
          return;
        }
        // A refreshed selection or callback must not receive the older completion.
        if (active() && current.current.selection === selection && current.current.onAdded === onAdded) onAdded?.();
      }}>{label}</Button>
    {message ? <span role="status">{message}</span> : null}
  </span>;
}
