import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Recipe } from "@nomnom/core/format";
import { api } from "@/lib/client";
import { RecipeCard } from "@/modules/recipe";
import { Button, Callout, space, usePalette } from "@/ui";

export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const insets = useSafeAreaInsets();
  const c = usePalette();

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    void (async () => {
      try {
        const next = await api.getRecipe(id);
        if (!cancelled) setRecipe(next);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load that recipe.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: recipe?.title ?? "Recipe" }} />
      <ScrollView
        style={{ backgroundColor: c.bg }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
      >
        {error ? (
          <Callout tone="error" title="Couldn't load that recipe">
            {error}
          </Callout>
        ) : recipe ? (
          <>
            <RecipeCard recipe={recipe} shelvedId={recipe.id} />
            <View style={styles.listAction}>
              <Button
                label={added ? "On your list ✓" : "Add to shopping list"}
                variant="ghost"
                disabled={added}
                onPress={() => {
                  void api.addRecipesToList([recipe.id]).then(() => setAdded(true));
                }}
              />
            </View>
          </>
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color={c.accent} />
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg },
  loading: { paddingVertical: space.xxl, alignItems: "center" },
  listAction: { marginTop: space.lg, alignSelf: "flex-start" },
});
