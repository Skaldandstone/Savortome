"use client";

import Link from "next/link";
import type { Recipe } from "@seconds/core/format";
import { ShelfControls } from "@/modules/shelves";
import { AddToListButton } from "@/modules/list";
import { SuggestMeal } from "@/modules/plan";
import { AllergenWarning } from "@/modules/profile";
import { IngredientList, ServingScaler } from "./IngredientList";
import { ImportTrace, Provenance } from "./Provenance";
import { NutritionFacts } from "./NutritionFacts";
import { PairingSuggestions } from "./PairingSuggestions";
import { RecipeFacts, TagList } from "./RecipeFacts";
import { RecipeExport } from "./RecipeExport";
import { RecipeHeader, RecipeHero } from "./RecipeHeader";
import { StepList } from "./StepList";
import { useServings } from "./useServings";
import styles from "./recipe.module.css";

/** Composes the recipe modules into the card the whole app is built to produce. */
export function RecipeCard({
  recipe,
  trace,
  /**
   * The recipe's database id, when it has one. A freshly extracted card that
   * failed to save has nothing to shelve, so the controls stay hidden.
   */
  shelvedId = null,
  verifiedAt = null,
}: {
  recipe: Recipe;
  trace?: string[];
  shelvedId?: string | null;
  verifiedAt?: string | null;
}) {
  const { servings, canScale, increment, decrement, ingredients } = useServings(recipe);

  return (
    <article className={styles.card}>
      <RecipeHero imageUrl={recipe.imageUrl} />

      <div className={styles.body}>
        <RecipeHeader recipe={recipe} />
        <RecipeFacts recipe={recipe} />
        <AllergenWarning ingredients={recipe.ingredients} />
        <NutritionFacts recipe={recipe} shelvedId={shelvedId} />
        <TagList tags={recipe.tags} />

        <div className={styles.ingredientsHeading}>
          <h3 className={styles.sectionTitle}>Ingredients</h3>
          {canScale && servings !== null ? (
            <div data-print="hide">
              <ServingScaler servings={servings} onIncrement={increment} onDecrement={decrement} />
            </div>
          ) : null}
        </div>
        <IngredientList ingredients={ingredients} />

        <h3 className={styles.sectionTitle}>Method</h3>
        <StepList steps={recipe.steps} source={recipe.source} />

        {recipe.equipment.length > 0 ? (
          <>
            <h3 className={styles.sectionTitle}>Equipment</h3>
            <p className={styles.equipment}>{recipe.equipment.join(", ")}</p>
          </>
        ) : null}

        <div data-print="hide">
          <ShelfControls recipeId={shelvedId} />
        </div>

        <div className={styles.listAction} data-print="hide">
          {shelvedId ? (
            <Link className={styles.cook} href={`/recipe/${shelvedId}/cook`}>
              Start cooking
            </Link>
          ) : null}
          <AddToListButton recipeId={shelvedId} />
          {shelvedId ? (
            <Link className={styles.edit} href={`/recipe/${shelvedId}/edit`}>
              Edit recipe
            </Link>
          ) : null}
        </div>

        {shelvedId ? <SuggestMeal recipeId={shelvedId} ingredients={recipe.ingredients} /> : null}

        <RecipeExport recipe={recipe} ingredients={ingredients} servings={servings} />

        <PairingSuggestions
          recipeId={shelvedId}
          mainNutrition={recipe.nutrition}
          servings={recipe.servings}
        />

        <Provenance recipe={recipe} verifiedAt={verifiedAt} />
        <ImportTrace trace={trace} />
      </div>
    </article>
  );
}
