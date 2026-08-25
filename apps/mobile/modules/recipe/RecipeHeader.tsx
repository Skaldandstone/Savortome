import { Image, Linking, StyleSheet, Text, View } from "react-native";
import type { Recipe } from "@nomnom/core/format";
import { space, type as typeScale, usePalette } from "@/ui";

export function RecipeHero({ imageUrl }: { imageUrl: string | null }) {
  if (!imageUrl) return null;
  return <Image source={{ uri: imageUrl }} style={styles.hero} accessibilityIgnoresInvertColors />;
}

export function RecipeHeader({ recipe }: { recipe: Recipe }) {
  const c = usePalette();
  const { source } = recipe;
  // Many blogs set author and site name to the same string; print it once.
  const label = source.siteName === source.author ? "View source" : (source.siteName ?? source.kind);

  return (
    <View>
      <Text style={[styles.title, { color: c.text }]}>{recipe.title}</Text>
      {recipe.description ? (
        <Text style={[styles.lede, { color: c.textMuted }]}>{recipe.description}</Text>
      ) : null}
      <Text style={[styles.attribution, { color: c.textMuted }]}>
        {source.author ? `By ${source.author} · ` : ""}
        {source.url ? (
          <Text style={{ color: c.accent }} onPress={() => Linking.openURL(source.url as string)}>
            {label}
          </Text>
        ) : (
          label
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { width: "100%", aspectRatio: 16 / 9 },
  title: { fontSize: typeScale.display, fontWeight: "700", letterSpacing: -0.5, marginBottom: 6 },
  lede: { fontSize: typeScale.body, lineHeight: 22, marginBottom: space.lg },
  attribution: { fontSize: typeScale.small, marginBottom: space.lg + 2 },
});
