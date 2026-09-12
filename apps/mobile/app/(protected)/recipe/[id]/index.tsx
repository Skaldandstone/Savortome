import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { OwnedRecipe } from "@seconds/core/format";
import { api } from "@/lib/client";
import { RecipeCard } from "@/modules/recipe";
import { ShareControl } from "@/modules/sharing";
import { Button, Callout, space, usePalette } from "@/ui";

export default function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [recipe, setRecipe] = useState<OwnedRecipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const insets = useSafeAreaInsets();
  const router = useRouter();
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
            <RecipeCard recipe={recipe} shelvedId={recipe.id} verifiedAt={recipe.verifiedAt} />
            <ShareControl recipeId={recipe.id} initialVisibility={recipe.visibility} />
            <View style={styles.cookAction}>
              <Button
                label="Start cooking"
                onPress={() => router.push(`/recipe/${recipe.id}/cook`)}
              />
            </View>
            <View style={styles.actions}>
              <Button
                label={added ? "On your list ✓" : "Add to shopping list"}
                variant="ghost"
                disabled={added}
                onPress={() => {
                  void api.addRecipesToList([recipe.id]).then(() => setAdded(true));
                }}
              />
              <Button
                label="Edit recipe"
                variant="ghost"
                onPress={() => router.push(`/recipe/${recipe.id}/edit`)}
              />
            </View>
          </>
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator accessibilityLabel="Loading recipe" color={c.accent} />
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg },
  loading: { paddingVertical: space.xxl, alignItems: "center" },
  cookAction: { marginTop: space.lg, alignSelf: "stretch" },
  actions: { flexDirection: "row", gap: space.sm, marginTop: space.md, alignSelf: "flex-start" },
});
