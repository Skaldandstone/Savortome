import { Image, Linking, StyleSheet, Text, View } from "react-native";
import type { Recipe } from "@seconds/core/format";
import { space, type as typeScale, usePalette } from "@/ui";
import { FoodIllustration, woodlandEnabled } from '@/modules/woodland/Artwork';

export function RecipeHero({ imageUrl }: { imageUrl: string | null }) {
  if (!imageUrl) return woodlandEnabled ? <View style={{alignItems:'center',paddingTop:18}}><FoodIllustration foodId="journal" size={120} /></View> : null;
  return <Image source={{ uri: imageUrl }} style={styles.hero} accessible={false} accessibilityIgnoresInvertColors />;
}

export function RecipeHeader({ recipe }: { recipe: Recipe }) {
  const c = usePalette();
  const { source } = recipe;
  // Many blogs set author and site name to the same string; print it once.
  const label = source.siteName === source.author ? "View source" : (source.siteName ?? source.kind);

  return (
    <View>
      <Text accessibilityRole="header" style={[styles.title, { color: woodlandEnabled ? c.accent : c.text, fontFamily:woodlandEnabled ? 'serif' : undefined }]}>{recipe.title}</Text>
      {recipe.description ? (
        <Text style={[styles.lede, { color: c.textMuted }]}>{recipe.description}</Text>
      ) : null}
      <Text style={[styles.attribution, { color: c.textMuted }]}>
        {source.author ? `By ${source.author} · ` : ""}
        {source.url ? (
          <Text
            accessibilityRole="link"
            accessibilityLabel={`${label}, opens source recipe`}
            style={{ color: c.accent }}
            onPress={() => Linking.openURL(source.url as string)}
          >
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
