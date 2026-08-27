"use client";

import { useMemo, useState } from "react";
import { scaleIngredients, type Ingredient, type Recipe } from "@seconds/core/format";

export interface ServingsControl {
  /** Null when the source never stated a serving count — scaling is hidden. */
  servings: number | null;
  canScale: boolean;
  increment: () => void;
  decrement: () => void;
  ingredients: Ingredient[];
}

/** Serving-count state and the scaled ingredient list that follows from it. */
export function useServings(recipe: Recipe): ServingsControl {
  const base = recipe.servings;
  const [servings, setServings] = useState(base);

  const factor = base && servings ? servings / base : 1;

  const ingredients = useMemo(
    () => scaleIngredients(recipe.ingredients, factor),
    [recipe.ingredients, factor],
  );

  return {
    servings,
    canScale: base !== null,
    increment: () => setServings((s) => (s ?? base ?? 1) + 1),
    decrement: () => setServings((s) => Math.max(1, (s ?? base ?? 1) - 1)),
    ingredients,
  };
}
