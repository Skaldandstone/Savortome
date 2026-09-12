import { useCallback, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  formatMinutes,
  SHELF_LABEL,
  type LibraryRecipe,
  type ShelfSummary,
  DEFAULT_LIBRARY_SORT,
  LIBRARY_SORTS,
  LIBRARY_SORT_LABEL,
  cookedLabel,
  type LibrarySort,
} from "@seconds/core/format";
import { api } from "@/lib/client";
import { KitchenWelcome } from '@/modules/woodland/KitchenWelcome';
import { FoodIllustration, TimberWash, woodlandEnabled } from '@/modules/woodland/Artwork';
import { useDecoration } from '@/ui/ThemeProvider';
import { SignOutButton } from "@/modules/account";
import { Button, Callout, Field, radius, space, type as typeScale, usePalette } from "@/ui";

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
  const { reduced } = useDecoration();
  const { fontScale } = useWindowDimensions();
  const [failedImage, setFailedImage] = useState(false);

  const meta = [
    recipe.attribution,
    formatMinutes(recipe.totalMinutes),
    recipe.ingredientCount ? `${recipe.ingredientCount} ingredients` : null,
    cookedLabel(recipe.timesCooked),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      onPress={() => router.push(`/recipe/${recipe.id}`)}
      accessibilityRole="button"
      style={[styles.row, woodlandEnabled && styles.woodlandRow, { backgroundColor: c.surface, borderColor: c.border }]}
    >
      <TimberWash />
      {woodlandEnabled ? (!reduced && fontScale < 1.6 && (recipe.imageUrl && !failedImage
        ? <Image source={{uri:recipe.imageUrl}} accessible={false} onError={() => setFailedImage(true)} fadeDuration={0} style={styles.recipeImage} />
        : <FoodIllustration foodId="journal" size={100} />))
        : <View style={[styles.thumb, { backgroundColor: c.surfaceSunken }]} />}
      <View style={styles.rowText}>
        <Text style={{ color: c.text, fontWeight: woodlandEnabled ? "400" : "700", fontFamily:woodlandEnabled ? 'serif' : undefined, fontSize:woodlandEnabled ? 20 : typeScale.body }}>
          {recipe.title}
        </Text>
        <Text style={{ color: c.textMuted, fontSize: typeScale.small, lineHeight:20 }}>
          {meta}
        </Text>
        {/* Your own verdict, not the community's. Cooked-but-unrated shows
            nothing rather than an accusing zero. */}
        {recipe.stars && recipe.stars > 0 ? (
          <Text
            style={{ color: c.accent, fontSize: typeScale.micro, letterSpacing: 1 }}
            accessibilityLabel={`You rated this ${recipe.stars} out of 5`}
          >
            {"★".repeat(recipe.stars)}
            <Text style={{ color: c.border }}>{"★".repeat(5 - recipe.stars)}</Text>
          </Text>
        ) : null}
        <ShelfBadge status={recipe.status} />
      </View>
      {woodlandEnabled && fontScale < 1.6 && <Text accessible={false} style={{color:c.accent,fontSize:24,paddingRight:8}}>›</Text>}
    </Pressable>
  );
}

/** Your own collection, filterable by shelf. The app's home. */
export function LibraryScreen() {
  const [shelves, setShelves] = useState<ShelfSummary[]>([]);
  const [recipes, setRecipes] = useState<LibraryRecipe[]>([]);
  const [activeShelf, setActiveShelf] = useState<string | undefined>();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<LibrarySort>(DEFAULT_LIBRARY_SORT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const c = usePalette();
  const { width, fontScale } = useWindowDimensions();

  const load = useCallback(
    async (shelfId?: string, search = "", order: LibrarySort = DEFAULT_LIBRARY_SORT) => {
    setError(null);
    try {
      const data = await api.library(shelfId, search, order);
      setShelves(data.shelves);
      setRecipes(data.recipes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your recipes.");
    } finally {
      setLoading(false);
    }
  },
    [],
  );

  // Refetch on focus: importing or shelving happens on other screens, and
  // coming back to a stale list is the most obvious kind of wrong.
  useFocusEffect(
    useCallback(() => {
      void load(activeShelf, query, sort);
    }, [load, activeShelf, query, sort]),
  );

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg, maxWidth:1000, width:'100%', alignSelf:'center' }]}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load(activeShelf, query, sort)} tintColor={c.accent} />
      }
    >
      <View style={styles.masthead}>
        {woodlandEnabled && <Image source={require('../../assets/icon.png')} accessible={false} style={{width:38,height:38,borderRadius:8}} />}
        <Text style={[styles.wordmark, { color: woodlandEnabled ? c.accent : c.text, fontFamily:woodlandEnabled ? 'serif' : undefined, flexShrink:1 }]}>Savortome™</Text>
        <View style={styles.spacer} />
        <SignOutButton />
      </View>
      <KitchenWelcome />

      <Link href="/import" asChild>
        <Pressable accessibilityRole="link" style={[styles.importCta, { backgroundColor: c.accent }]}>
          <Text style={[styles.importCtaText,{color:c.onAccent}]}>Import a recipe</Text>
        </Pressable>
      </Link>

      <View style={styles.searchRow}>
        <Field
          value={query}
          placeholder="Search a name, a tag, an ingredient"
          autoCapitalize="none"
          returnKeyType="search"
          accessibilityLabel="Search your recipes"
          style={styles.searchInput}
          onChangeText={setQuery}
          onSubmitEditing={() => void load(activeShelf, query, sort)}
        />
        <Button label="Search" onPress={() => void load(activeShelf, query, sort)} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.sortRow}>
        {LIBRARY_SORTS.map((option) => (
          <Button
            key={option}
            label={LIBRARY_SORT_LABEL[option]}
            variant="toggle"
            selected={sort === option}
            onPress={() => setSort(option)}
          />
        ))}
      </ScrollView>

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

      {woodlandEnabled && <View style={{marginTop:22,marginBottom:6}}><Text accessibilityRole="header" style={{color:c.accent,fontFamily:'serif',fontSize:25}}>Your recipes</Text><Text style={{color:c.textMuted,fontSize:14,lineHeight:22}}>A journal of meals and memories.</Text></View>}
      <View style={[styles.list, width >= 800 && fontScale < 1.4 && styles.grid]}>
        {recipes.map((recipe) => (
          <View key={recipe.id} style={width >= 800 && fontScale < 1.4 ? {width:'48.7%'} : undefined}><RecipeRow recipe={recipe} /></View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg + 4, paddingBottom: space.xxl * 2 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.md },
  sortRow: { marginBottom: space.sm },
  searchInput: { flex: 1 },
  masthead: { flexDirection: "row", flexWrap:'wrap', gap:10, alignItems: "center", marginBottom: space.lg },
  wordmark: { fontSize: typeScale.display, fontWeight: "700", letterSpacing: -0.5 },
  spacer: { flex: 1 },
  importCta: { borderRadius: radius.sm, paddingVertical: 13, alignItems: "center" },
  importCtaText: { color: "#fff", fontWeight: "700", fontSize: typeScale.body },
  shelfRow: { marginTop: space.md, marginBottom: space.xs },
  list: { marginTop: space.md, gap: space.sm },
  grid: { flexDirection:'row',flexWrap:'wrap',gap:16 },
  woodlandRow:{padding:0,borderRadius:5,overflow:'hidden',minHeight:110},
  recipeImage:{width:100,height:110},
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.sm + 2,
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  thumb: { width: 56, height: 42, borderRadius: 6 },
  rowText: { flex: 1, paddingVertical:10, paddingHorizontal:4,gap:5 },
  badge: {
    fontSize: typeScale.micro,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: "hidden",
    alignSelf:'flex-start',
  },
  empty: { fontSize: typeScale.small, marginTop: space.lg, lineHeight: 19 },
});
