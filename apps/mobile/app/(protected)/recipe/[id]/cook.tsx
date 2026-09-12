import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import type { OwnedRecipe } from "@seconds/core/format";
import { api } from "@/lib/client";
import { CookScreen } from "@/modules/cook";
import { Callout, space, usePalette } from "@/ui";

/** The recipe, one step at a time, for someone actually standing at the stove. */
export default function CookRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [recipe, setRecipe] = useState<OwnedRecipe | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  if (error || !recipe) {
    return (
      <View style={[styles.centre, { backgroundColor: c.bg }]}>
        <Stack.Screen options={{ headerShown: true, title: "Cook" }} />
        {error ? (
          <Callout tone="error" title="Couldn't open that recipe">
            {error}
          </Callout>
        ) : (
          <ActivityIndicator accessibilityLabel="Loading cooking mode" color={c.accent} />
        )}
      </View>
    );
  }

  return <CookScreen recipe={recipe} recipeId={recipe.id} />;
}

const styles = StyleSheet.create({
  centre: { flex: 1, padding: space.lg, paddingTop: space.xxl },
});
