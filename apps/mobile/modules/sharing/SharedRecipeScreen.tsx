import { useEffect, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { DiscoverCard, Recipe, SharedRecipeView } from "@seconds/core/format";
import { api } from "@/lib/client";
import { DiscoverRow } from "@/modules/discover";
import { RecipeCard } from "@/modules/recipe";
import { Button, Callout, space, type as typeScale, usePalette } from "@/ui";

/**
 * Someone else's shared recipe, opened from a link, the friends feed, or
 * discovery. The card and nothing about the owner's own relationship with it.
 */
export function SharedRecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [view, setView] = useState<SharedRecipeView | null>(null);
  const [similar, setSimilar] = useState<DiscoverCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const c = usePalette();

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    void (async () => {
      try {
        const shared = await api.getSharedRecipe(id);
        if (cancelled) return;
        setRecipe(shared.recipe);
        setView(shared.view);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "That recipe isn't available.");
        }
      }
    })();

    // Similar recipes are a bonus; a failure here shouldn't shout.
    void api
      .similarRecipes(id)
      .then((next) => {
        if (!cancelled) setSimilar(next);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [id]);

  const save = async () => {
    if (!view) return;
    setSaving(true);
    try {
      const { recipeId } = await api.saveSharedRecipe(view.recipeId);
      router.replace(`/recipe/${recipeId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: recipe?.title ?? "Recipe" }} />
      <ScrollView
        style={{ backgroundColor: c.bg }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xxl }]}
      >
        {error ? (
          <Callout tone="error" title="Couldn't open that recipe">
            {error}
          </Callout>
        ) : !recipe || !view ? (
          <View style={styles.loading}>
            <ActivityIndicator color={c.accent} />
          </View>
        ) : (
          <>
            <View style={styles.sharedBy}>
              {view.sharedBy.avatarUrl ? (
                <Image
                  source={{ uri: view.sharedBy.avatarUrl }}
                  style={styles.avatar}
                  accessibilityIgnoresInvertColors
                />
              ) : null}
              <Text style={{ color: c.textMuted, fontSize: typeScale.small }}>
                Shared by {view.sharedBy.displayName}
                {view.saveCount > 0
                  ? ` · saved by ${view.saveCount} ${view.saveCount === 1 ? "person" : "people"}`
                  : ""}
              </Text>
            </View>

            <RecipeCard recipe={recipe} />

            <View style={styles.saveRow}>
              {view.alreadySaved ? (
                <Text style={{ color: c.good, fontSize: typeScale.small }}>
                  This is already in your collection.
                </Text>
              ) : view.canSave ? (
                <Button
                  label={saving ? "Saving…" : "Save to my collection"}
                  disabled={saving}
                  onPress={() => void save()}
                />
              ) : null}
            </View>

            {similar.length > 0 ? (
              <View style={styles.similar}>
                <Text style={[styles.similarHeading, { color: c.textMuted }]}>MORE LIKE THIS</Text>
                {similar.map((card) => (
                  <DiscoverRow key={card.recipeId} card={card} />
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg },
  loading: { paddingVertical: space.xxl, alignItems: "center" },
  sharedBy: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.md },
  avatar: { width: 28, height: 28, borderRadius: 999 },
  saveRow: { marginTop: space.lg, alignSelf: "flex-start" },
  similar: { marginTop: space.xl },
  similarHeading: {
    fontSize: typeScale.micro,
    letterSpacing: 1,
    fontWeight: "600",
    marginBottom: space.sm,
  },
});
