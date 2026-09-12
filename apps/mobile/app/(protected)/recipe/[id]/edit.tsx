import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { draftFromRecipe, type RecipeDraft } from "@seconds/core/format";
import { api } from "@/lib/client";
import { RecipeEditorScreen } from "@/modules/editor";
import { Callout, space, usePalette } from "@/ui";

/** Fix what the extractor got wrong — or anything you've since changed your mind about. */
export default function EditRecipeRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [initial, setInitial] = useState<RecipeDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const c = usePalette();

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    void (async () => {
      try {
        const recipe = await api.getRecipe(id);
        if (!cancelled) setInitial(draftFromRecipe(recipe));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load that recipe.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <View style={[styles.centre, { backgroundColor: c.bg }]}>
        <Stack.Screen options={{ headerShown: true, title: "Edit recipe" }} />
        <Callout tone="error" title="Couldn't open that recipe">
          {error}
        </Callout>
      </View>
    );
  }

  // The form is seeded once, so it can't be rendered until the recipe is here.
  if (!initial) {
    return (
      <View style={[styles.centre, { backgroundColor: c.bg }]}>
        <Stack.Screen options={{ headerShown: true, title: "Edit recipe" }} />
        <ActivityIndicator accessibilityLabel="Loading recipe editor" color={c.accent} />
      </View>
    );
  }

  return <RecipeEditorScreen recipeId={id} initial={initial} />;
}

const styles = StyleSheet.create({
  centre: { flex: 1, padding: space.lg, paddingTop: space.xxl },
});
