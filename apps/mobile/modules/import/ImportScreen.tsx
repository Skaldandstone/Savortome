import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Link } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SignOutButton } from "@/modules/account";
import { RecipeCard } from "@/modules/recipe";
import { Callout, Panel, PanelHeader, space, type as typeScale, usePalette } from "@/ui";
import { ImportForm } from "./ImportForm";
import { ImportProgress } from "./ImportProgress";
import { useImport } from "./useImport";

/** The app's front door: paste something, get a recipe card. */
export function ImportScreen() {
  const { stage, busy, error, result, run } = useImport();
  const insets = useSafeAreaInsets();
  const c = usePalette();

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.masthead}>
        <Text style={[styles.wordmark, { color: c.text }]}>NomNom</Text>
        <Text style={[styles.tagline, { color: c.textMuted }]}>recipes, from anywhere</Text>
        <View style={styles.spacer} />
        <SignOutButton />
      </View>

      <View style={styles.navRow}>
        <Link href="/cook" style={[styles.navLink, { color: c.accent }]}>
          What can I make?
        </Link>
        <Link href="/list" style={[styles.navLink, { color: c.accent }]}>
          Shopping list
        </Link>
      </View>

      <Panel>
        <PanelHeader
          title="Import a recipe"
          hint="Paste a link to a YouTube video, TikTok, Reel, or a blog post buried under a life story."
        />

        <ImportForm busy={busy} onSubmit={run} />

        {stage !== null ? <ImportProgress stage={stage} /> : null}

        {error ? (
          <Callout tone="error" title="That import did not go through">
            {error.message}
          </Callout>
        ) : null}

        {result?.saveError ? (
          <Callout tone="error" title="Extracted, but not saved">
            {result.saveError}
          </Callout>
        ) : null}
      </Panel>

      {result ? (
        <RecipeCard recipe={result.recipe} shelvedId={result.saved ? result.recipe.id : null} />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg + 4, paddingBottom: space.xxl * 3 },
  masthead: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: space.md,
    marginBottom: space.xl + 4,
  },
  wordmark: { fontSize: typeScale.display, fontWeight: "700", letterSpacing: -0.5 },
  tagline: { fontSize: 14 },
  spacer: { flex: 1 },
  navRow: { flexDirection: "row", gap: space.lg, marginBottom: space.lg },
  navLink: { fontSize: 15, fontWeight: "600" },
});
