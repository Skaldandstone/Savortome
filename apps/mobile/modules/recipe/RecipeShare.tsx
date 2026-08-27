import { Share, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { recipeToText, type Ingredient, type Recipe } from "@seconds/core/format";
import { radius, space, type as typeScale, usePalette } from "@/ui";

/**
 * Sending a recipe somewhere else.
 *
 * A phone has no print dialog, so the share sheet is the equivalent — it
 * reaches Messages, Mail, Notes and anything else installed without this app
 * needing to know any of them exist. Plain text rather than Markdown, because
 * most of those destinations render nothing and `#` would just be litter.
 *
 * Shares what's on screen, so a recipe scaled to six servings shares scaled.
 */
export function RecipeShare({
  recipe,
  ingredients,
  servings,
}: {
  recipe: Recipe;
  ingredients: Ingredient[];
  servings: number | null;
}) {
  const c = usePalette();

  const share = async () => {
    try {
      await Share.share({
        title: recipe.title,
        message: recipeToText(recipe, { ingredients, servings }),
      });
    } catch {
      // Dismissing the sheet rejects on some platforms; that isn't an error.
    }
  };

  return (
    <View style={styles.row}>
      <TouchableOpacity
        accessibilityRole="button"
        style={[styles.button, { borderColor: c.border }]}
        onPress={() => void share()}
      >
        <Text style={[styles.label, { color: c.textMuted }]}>Share recipe</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", marginTop: space.lg },
  button: {
    paddingVertical: space.sm + 2,
    paddingHorizontal: space.lg,
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  label: { fontSize: typeScale.small, fontWeight: "600" },
});
