"use client";

import Link from "next/link";
import type { Recipe } from "@seconds/core/format";
import { ShelfControls } from "@/modules/shelves";
import { AddToListButton } from "@/modules/list";
import { IngredientList, ServingScaler } from "./IngredientList";
import { ImportTrace, Provenance } from "./Provenance";
import { RecipeFacts, TagList } from "./RecipeFacts";
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
        <TagList tags={recipe.tags} />

        <div className={styles.ingredientsHeading}>
          <h3 className={styles.sectionTitle}>Ingredients</h3>
          {canScale && servings !== null ? (
            <ServingScaler servings={servings} onIncrement={increment} onDecrement={decrement} />
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

        <ShelfControls recipeId={shelvedId} />

        <div className={styles.listAction}>
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

        <Provenance recipe={recipe} verifiedAt={verifiedAt} />
        <ImportTrace trace={trace} />
      </div>
    </article>
  );
}
