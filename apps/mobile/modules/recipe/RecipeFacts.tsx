import { StyleSheet, Text, View } from "react-native";
import { formatMinutes, type Recipe } from "@nomnom/core/format";
import { radius, space, type as typeScale, usePalette } from "@/ui";

/** The at-a-glance strip: how long, how many, what kind. */
export function RecipeFacts({ recipe }: { recipe: Recipe }) {
  const c = usePalette();
  const facts: [string, string][] = [];

  if (recipe.servingsNote && !recipe.servings) facts.push(["Yield", recipe.servingsNote]);
  const prep = formatMinutes(recipe.prepMinutes);
  const cook = formatMinutes(recipe.cookMinutes);
  const total = formatMinutes(recipe.totalMinutes);
  if (prep) facts.push(["Prep", prep]);
  if (cook) facts.push(["Cook", cook]);
  if (total) facts.push(["Total", total]);
  if (recipe.cuisine) facts.push(["Cuisine", recipe.cuisine]);
  if (recipe.difficulty) facts.push(["Effort", recipe.difficulty]);

  if (facts.length === 0) return null;

  return (
    <View style={[styles.facts, { borderColor: c.border }]}>
      {facts.map(([label, value]) => (
        <View key={label} style={styles.fact}>
          <Text style={[styles.label, { color: c.textMuted }]}>{label.toUpperCase()}</Text>
          <Text style={[styles.value, { color: c.text }]}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

export function TagList({ tags }: { tags: string[] }) {
  const c = usePalette();
  if (tags.length === 0) return null;

  return (
    <View style={styles.tags}>
      {tags.map((tag) => (
        <Text key={tag} style={[styles.tag, { backgroundColor: c.surfaceSunken, color: c.textMuted }]}>
          {tag}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  facts: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.lg,
    paddingVertical: space.md + 2,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  fact: { minWidth: 64 },
  label: { fontSize: typeScale.micro, letterSpacing: 0.5 },
  value: { fontSize: 14, fontWeight: "600" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: space.lg },
  tag: { fontSize: typeScale.micro, paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill },
});
