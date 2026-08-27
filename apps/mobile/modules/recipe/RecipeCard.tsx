import { StyleSheet, Text, View } from "react-native";
import type { Recipe } from "@seconds/core/format";
import { radius, space, type as typeScale, usePalette } from "@/ui";
import { ShelfControls } from "@/modules/shelves";
import { IngredientList, ServingScaler } from "./IngredientList";
import { Provenance } from "./Provenance";
import { RecipeFacts, TagList } from "./RecipeFacts";
import { RecipeShare } from "./RecipeShare";
import { RecipeHeader, RecipeHero } from "./RecipeHeader";
import { StepList } from "./StepList";
import { useServings } from "./useServings";

function SectionTitle({ children }: { children: string }) {
  const c = usePalette();
  return <Text style={[styles.sectionTitle, { color: c.textMuted }]}>{children.toUpperCase()}</Text>;
}

/** Composes the recipe modules into the card the whole app is built to produce. */
export function RecipeCard({
  recipe,
  /** The recipe's database id, when it has one. Unsaved cards can't be shelved. */
  shelvedId = null,
  verifiedAt = null,
}: {
  recipe: Recipe;
  shelvedId?: string | null;
  verifiedAt?: string | null;
}) {
  const { servings, canScale, increment, decrement, ingredients } = useServings(recipe);
  const c = usePalette();

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <RecipeHero imageUrl={recipe.imageUrl} />

      <View style={styles.body}>
        <RecipeHeader recipe={recipe} />
        <RecipeFacts recipe={recipe} />
        <TagList tags={recipe.tags} />

        <View style={styles.ingredientsHeading}>
          <SectionTitle>Ingredients</SectionTitle>
          {canScale && servings !== null ? (
            <ServingScaler servings={servings} onIncrement={increment} onDecrement={decrement} />
          ) : null}
        </View>
        <IngredientList ingredients={ingredients} />

        <SectionTitle>Method</SectionTitle>
        <StepList steps={recipe.steps} source={recipe.source} />

        {recipe.equipment.length > 0 ? (
          <>
            <SectionTitle>Equipment</SectionTitle>
            <Text style={[styles.equipment, { color: c.text }]}>{recipe.equipment.join(", ")}</Text>
          </>
        ) : null}

        <ShelfControls recipeId={shelvedId} />

        <RecipeShare recipe={recipe} ingredients={ingredients} servings={servings} />

        <Provenance recipe={recipe} verifiedAt={verifiedAt} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: space.xl + 4, borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  body: { padding: space.xl },
  sectionTitle: {
    marginTop: space.xl + 4,
    marginBottom: space.sm + 2,
    fontSize: typeScale.small,
    letterSpacing: 1,
    fontWeight: "600",
  },
  ingredientsHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  equipment: { fontSize: typeScale.body },
});
