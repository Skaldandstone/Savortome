import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  NEARLY_THERE_LIMIT,
  describeMatch,
  formatMinutes,
  type PantrySearchResponse,
  type PantrySearchResult,
} from "@seconds/core/format";
import { radius, space, type as typeScale, usePalette } from "@/ui";

function MatchRow({ match }: { match: PantrySearchResult }) {
  const c = usePalette();
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(`/recipe/${match.recipeId}`)}
      accessibilityRole="button"
      style={[styles.match, { backgroundColor: c.surface, borderColor: c.border }]}
    >
      {match.imageUrl ? (
        <Image source={{ uri: match.imageUrl }} style={styles.thumb} accessible={false} accessibilityIgnoresInvertColors />
      ) : (
        <View style={[styles.thumb, { backgroundColor: c.surfaceSunken }]} />
      )}
      <View style={styles.matchText}>
        <Text style={{ color: c.text, fontWeight: "700", fontSize: typeScale.body }}>
          {match.title}
        </Text>
        <Text style={{ color: c.textMuted, fontSize: typeScale.small }}>
          {[describeMatch(match), formatMinutes(match.totalMinutes)].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <Text
        style={[
          styles.coverage,
          { color: match.canMakeNow ? c.good : c.textMuted },
          match.canMakeNow && styles.coverageTick,
        ]}
      >
        {match.canMakeNow ? "✓" : `${Math.round(match.coverage * 100)}%`}
      </Text>
    </Pressable>
  );
}

function Group({ title, matches }: { title: string; matches: PantrySearchResult[] }) {
  const c = usePalette();
  if (matches.length === 0) return null;

  return (
    <View style={styles.group}>
      <Text accessibilityRole="header" style={[styles.groupHeading, { color: c.textMuted }]}>{title.toUpperCase()}</Text>
      {matches.map((m) => (
        <MatchRow key={m.recipeId} match={m} />
      ))}
    </View>
  );
}

/**
 * Split into what you can cook tonight, what you're a couple of items away
 * from, and the rest. The middle group is the useful one.
 */
export function MatchList({ results }: { results: PantrySearchResult[] }) {
  const c = usePalette();

  if (results.length === 0) {
    return (
      <Text style={[styles.empty, { color: c.textMuted }]}>
        Nothing in your collection matches that yet.
      </Text>
    );
  }

  const now = results.filter((r) => r.canMakeNow);
  const nearly = results.filter((r) => !r.canMakeNow && r.missing.length <= NEARLY_THERE_LIMIT);
  const rest = results.filter((r) => !r.canMakeNow && r.missing.length > NEARLY_THERE_LIMIT);

  return (
    <View>
      <Group title="Cook tonight" matches={now} />
      <Group title={now.length > 0 ? "Nearly there" : "Closest matches"} matches={nearly} />
      <Group title="Further off" matches={rest} />
    </View>
  );
}

/** Shows what the search actually understood, so a wrong result is explicable. */
export function QueryReadback({
  query,
  interpreted,
  usedPantry,
}: {
  query: PantrySearchResponse["query"];
  interpreted: boolean;
  usedPantry: boolean;
}) {
  const c = usePalette();
  const parts: string[] = [];

  if (query.ingredients.length > 0) {
    parts.push(`${usedPantry ? "your pantry" : "using"}: ${query.ingredients.join(", ")}`);
  }
  if (query.excludeIngredients.length > 0) parts.push(`without ${query.excludeIngredients.join(", ")}`);
  if (query.tags.length > 0) parts.push(query.tags.join(", "));
  if (query.maxMinutes) parts.push(`under ${query.maxMinutes} min`);
  if (query.course) parts.push(query.course);

  if (parts.length === 0) return null;

  return (
    <Text style={[styles.readback, { color: c.textMuted }]}>
      {interpreted ? "Searched for " : "Matching "}
      {parts.join(" · ")}
    </Text>
  );
}

const styles = StyleSheet.create({
  group: { marginTop: space.xl },
  groupHeading: { fontSize: typeScale.micro, letterSpacing: 1, fontWeight: "600", marginBottom: space.sm },
  match: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    padding: space.sm + 2,
    borderWidth: 1,
    borderRadius: radius.sm,
    marginBottom: space.sm,
  },
  thumb: { width: 56, height: 42, borderRadius: 6 },
  matchText: { flex: 1 },
  coverage: { fontSize: typeScale.small, fontWeight: "700", minWidth: 40, textAlign: "right" },
  coverageTick: { fontSize: typeScale.title },
  readback: { fontSize: typeScale.small, marginBottom: space.sm },
  empty: { fontSize: typeScale.small, marginTop: space.md },
});
