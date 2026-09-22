"use client";

import { useCallback, useState } from "react";
import {
  blankIngredient,
  blankStep,
  groupHeading,
  moveItem,
  type Ingredient,
  type RecipeDraft,
  type Step,
} from "@seconds/core/format";

/**
 * The form's state.
 *
 * Kept deliberately dumb: it holds exactly what was typed and nothing derived.
 * Normalising and validating happen once, in the database layer, so the two
 * write paths — this form and anything else that ever saves a recipe — can't
 * disagree about what a valid recipe is.
 */
export function useDraft(initial: RecipeDraft) {
  const [draft, setDraft] = useState<RecipeDraft>(initial);
  const [dirty, setDirty] = useState(false);

  const edit = useCallback((change: (current: RecipeDraft) => RecipeDraft) => {
    setDirty(true);
    setDraft(change);
  }, []);

  const set = useCallback(
    <K extends keyof RecipeDraft>(key: K, value: RecipeDraft[K]) =>
      edit((current) => ({ ...current, [key]: value })),
    [edit],
  );

  const restore = useCallback((next: RecipeDraft) => {
    setDraft(next);
    setDirty(true);
  }, []);

  const ingredients = {
    replace: (index: number, ingredient: Ingredient) =>
      edit((current) => ({
        ...current,
        ingredients: current.ingredients.map((ing, i) => (i === index ? ingredient : ing)),
      })),
    add: () =>
      edit((current) => ({ ...current, ingredients: [...current.ingredients, blankIngredient()] })),
    addHeading: () =>
      edit((current) => ({ ...current, ingredients: [...current.ingredients, groupHeading("")] })),
    remove: (index: number) =>
      edit((current) => {
        const next = current.ingredients.filter((_, i) => i !== index);
        // Never leave nothing to type into.
        return { ...current, ingredients: next.length > 0 ? next : [blankIngredient()] };
      }),
    move: (from: number, to: number) =>
      edit((current) => ({ ...current, ingredients: moveItem(current.ingredients, from, to) })),
  };

  const steps = {
    replace: (index: number, step: Step) =>
      edit((current) => ({
        ...current,
        steps: current.steps.map((s, i) => (i === index ? step : s)),
      })),
    add: () =>
      edit((current) => ({
        ...current,
        steps: [...current.steps, blankStep(current.steps.length + 1)],
      })),
    remove: (index: number) =>
      edit((current) => {
        const next = current.steps
          .filter((_, i) => i !== index)
          .map((step, i) => ({ ...step, n: i + 1 }));
        return { ...current, steps: next.length > 0 ? next : [blankStep(1)] };
      }),
    move: (from: number, to: number) =>
      edit((current) => ({
        ...current,
        steps: moveItem(current.steps, from, to).map((step, i) => ({ ...step, n: i + 1 })),
      })),
  };

  return { draft, dirty, restore, set, ingredients, steps };
}

export type DraftList = ReturnType<typeof useDraft>["ingredients"];
