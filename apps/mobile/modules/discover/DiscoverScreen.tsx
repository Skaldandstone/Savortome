import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatMinutes, type DiscoverCard, type DiscoverResponse } from "@seconds/core/format";
import { api } from "@/lib/client";
import {
  Button,
  Callout,
  Field,
  Panel,
  PanelHeader,
  radius,
  space,
  type as typeScale,
  usePalette,
} from "@/ui";

const EMPTY: DiscoverResponse = { recipes: [], tags: [], query: "", appliedTags: [] };

/** One shared recipe, as it appears while browsing. */
export function DiscoverRow({ card }: { card: DiscoverCard }) {
  const c = usePalette();
  const router = useRouter();

  const meta = [
    formatMinutes(card.totalMinutes),
    card.cuisine,
    card.saveCount > 0 ? `${card.saveCount} saved` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      onPress={() => router.push(`/r/${card.recipeId}`)}
      accessibilityRole="button"
      style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
    >
      {card.imageUrl ? (
        <Image
          source={{ uri: card.imageUrl }}
          style={styles.thumb}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[styles.thumb, { backgroundColor: c.surfaceSunken }]} />
      )}
      <View style={styles.cardBody}>
        <Text style={{ color: c.text, fontWeight: "700", fontSize: typeScale.body }}>
          {card.title}
        </Text>
        {card.reason ? (
          <Text style={{ color: c.accent, fontSize: typeScale.micro, fontWeight: "600" }}>
            {card.reason}
          </Text>
        ) : null}
        {card.description ? (
          <Text
            style={{ color: c.textMuted, fontSize: typeScale.small }}
            numberOfLines={2}
          >
            {card.description}
          </Text>
        ) : null}
        <Text style={{ color: c.textMuted, fontSize: typeScale.micro }}>
          by {card.sharedBy.displayName}
          {meta ? ` · ${meta}` : ""}
        </Text>
      </View>
    </Pressable>
  );
}

/** Browse and search what other people have shared. */
export function DiscoverScreen() {
  const [data, setData] = useState<DiscoverResponse>(EMPTY);
  const [query, setQuery] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const c = usePalette();

  const load = useCallback(async (nextQuery: string, nextTags: string[]) => {
    setLoading(true);
    setError(null);
    try {
      setData(await api.discover({ query: nextQuery, tags: nextTags }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load recipes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load("", []);
  }, [load]);

  const toggleTag = (tag: string) => {
    const next = activeTags.includes(tag)
      ? activeTags.filter((t) => t !== tag)
      : [...activeTags, tag];
    setActiveTags(next);
    void load(query, next);
  };

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]}
      keyboardShouldPersistTaps="handled"
    >
      <Panel>
        <PanelHeader
          title="Discover"
          hint="Recipes other people have shared. Search by name, cuisine, or what it is."
        />

        <View style={styles.searchRow}>
          <Field
            value={query}
            onChangeText={setQuery}
            placeholder="kimchi, one-pan, something Korean…"
            autoCapitalize="none"
            style={styles.searchInput}
            onSubmitEditing={() => void load(query, activeTags)}
          />
          <Button label="Search" disabled={loading} onPress={() => void load(query, activeTags)} />
        </View>

        {data.tags.length > 0 ? (
          <View style={styles.tags}>
            {data.tags.map(({ tag, count }) => {
              const active = activeTags.includes(tag);
              return (
                <Pressable
                  key={tag}
                  onPress={() => toggleTag(tag)}
                  disabled={loading}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.tag,
                    {
                      backgroundColor: active ? c.accentSoft : c.surfaceSunken,
                      borderColor: active ? c.accent : c.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? c.accent : c.textMuted,
                      fontSize: typeScale.micro,
                      fontWeight: active ? "600" : "400",
                    }}
                  >
                    {tag} {count}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {error ? <Callout tone="error">{error}</Callout> : null}
      </Panel>

      <View style={styles.results}>
        {loading ? (
          <Text style={[styles.empty, { color: c.textMuted }]}>Looking…</Text>
        ) : data.recipes.length === 0 ? (
          <Text style={[styles.empty, { color: c.textMuted }]}>
            {data.query || activeTags.length > 0
              ? "Nothing shared matches that yet."
              : "No one has shared anything yet."}
          </Text>
        ) : (
          data.recipes.map((card) => <DiscoverRow key={card.recipeId} card={card} />)
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg + 4, paddingBottom: space.xxl * 2 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  searchInput: { flex: 1 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: space.md },
  tag: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 4 },
  results: { marginTop: space.lg, gap: space.sm },
  card: {
    flexDirection: "row",
    gap: space.md,
    padding: space.md,
    borderWidth: 1,
    borderRadius: radius.md,
    marginBottom: space.sm,
  },
  thumb: { width: 80, height: 62, borderRadius: 8 },
  cardBody: { flex: 1, gap: 2 },
  empty: { fontSize: typeScale.small, lineHeight: 19 },
});
