import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  formatMinutes,
  SHELF_LABEL,
  type LibraryRecipe,
  type ShelfSummary,
} from "@nomnom/core/format";
import { api } from "@/lib/client";
import { SignOutButton } from "@/modules/account";
import { Button, Callout, radius, space, type as typeScale, usePalette } from "@/ui";

function ShelfBadge({ status }: { status: LibraryRecipe["status"] }) {
  const c = usePalette();
  if (!status) return null;

  const tone =
    status === "cooked" ? c.accent : status === "cooking" ? c.warn : c.textMuted;
  const background =
    status === "cooked" ? c.accentSoft : status === "cooking" ? c.warnSoft : c.surfaceSunken;

  return (
    <Text style={[styles.badge, { color: tone, backgroundColor: background }]}>
      {SHELF_LABEL[status]}
    </Text>
  );
}

function RecipeRow({ recipe }: { recipe: LibraryRecipe }) {
  const c = usePalette();
  const router = useRouter();

  const meta = [
    recipe.attribution,
    formatMinutes(recipe.totalMinutes),
    recipe.ingredientCount ? `${recipe.ingredientCount} ingredients` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      onPress={() => router.push(`/recipe/${recipe.id}`)}
      accessibilityRole="button"
      style={[styles.row, { backgroundColor: c.surface, borderColor: c.border }]}
    >
      <View style={[styles.thumb, { backgroundColor: c.surfaceSunken }]} />
      <View style={styles.rowText}>
        <Text style={{ color: c.text, fontWeight: "700", fontSize: typeScale.body }}>
          {recipe.title}
        </Text>
        <Text style={{ color: c.textMuted, fontSize: typeScale.small }} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <ShelfBadge status={recipe.status} />
    </Pressable>
  );
}

/** Your own collection, filterable by shelf. The app's home. */
export function LibraryScreen() {
  const [shelves, setShelves] = useState<ShelfSummary[]>([]);
  const [recipes, setRecipes] = useState<LibraryRecipe[]>([]);
  const [activeShelf, setActiveShelf] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const c = usePalette();

  const load = useCallback(async (shelfId?: string) => {
    setError(null);
    try {
      const data = await api.library(shelfId);
      setShelves(data.shelves);
      setRecipes(data.recipes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your recipes.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch on focus: importing or shelving happens on other screens, and
  // coming back to a stale list is the most obvious kind of wrong.
  useFocusEffect(
    useCallback(() => {
      void load(activeShelf);
    }, [load, activeShelf]),
  );

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load(activeShelf)} tintColor={c.accent} />
      }
    >
      <View style={styles.masthead}>
        <Text style={[styles.wordmark, { color: c.text }]}>NomNom</Text>
        <View style={styles.spacer} />
        <SignOutButton />
      </View>

      <Link href="/import" asChild>
        <Pressable style={[styles.importCta, { backgroundColor: c.accent }]}>
          <Text style={styles.importCtaText}>Import a recipe</Text>
        </Pressable>
      </Link>

      {shelves.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.shelfRow}>
          <Button
            label="All"
            variant="toggle"
            selected={!activeShelf}
            onPress={() => setActiveShelf(undefined)}
          />
          {shelves.map((shelf) => (
            <Button
              key={shelf.id}
              label={shelf.recipeCount > 0 ? `${shelf.name} ${shelf.recipeCount}` : shelf.name}
              variant="toggle"
              selected={activeShelf === shelf.id}
              onPress={() => setActiveShelf(shelf.id)}
            />
          ))}
        </ScrollView>
      ) : null}

      {error ? <Callout tone="error">{error}</Callout> : null}

      {!loading && recipes.length === 0 ? (
        <Text style={[styles.empty, { color: c.textMuted }]}>
          {activeShelf ? "Nothing on this shelf yet." : "Nothing here yet. Import something above."}
        </Text>
      ) : null}

      <View style={styles.list}>
        {recipes.map((recipe) => (
          <RecipeRow key={recipe.id} recipe={recipe} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg + 4, paddingBottom: space.xxl * 2 },
  masthead: { flexDirection: "row", alignItems: "center", marginBottom: space.lg },
  wordmark: { fontSize: typeScale.display, fontWeight: "700", letterSpacing: -0.5 },
  spacer: { flex: 1 },
  importCta: { borderRadius: radius.sm, paddingVertical: 13, alignItems: "center" },
  importCtaText: { color: "#fff", fontWeight: "700", fontSize: typeScale.body },
  shelfRow: { marginTop: space.md, marginBottom: space.xs },
  list: { marginTop: space.md, gap: space.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.sm + 2,
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  thumb: { width: 56, height: 42, borderRadius: 6 },
  rowText: { flex: 1 },
  badge: {
    fontSize: typeScale.micro,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  empty: { fontSize: typeScale.small, marginTop: space.lg, lineHeight: 19 },
});
