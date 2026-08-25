import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RecipeCard } from "@/modules/recipe";
import { Button, Callout, Panel, PanelHeader, space, usePalette } from "@/ui";
import { ImportForm } from "./ImportForm";
import { ImportProgress } from "./ImportProgress";
import { useImport } from "./useImport";

/** The app's front door: paste something, get a recipe card. */
export function ImportScreen() {
  const { stage, busy, error, result, run } = useImport();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const c = usePalette();

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]}
      keyboardShouldPersistTaps="handled"
    >
      <Panel>
        <PanelHeader
          title="Import a recipe"
          hint="Paste a link to a YouTube video, TikTok, Reel, or a blog post buried under a life story."
        />

        <ImportForm busy={busy} onSubmit={run} />

        <View style={styles.writeOne}>
          <Button
            label="Or write one yourself"
            variant="ghost"
            onPress={() => router.push("/recipe/new")}
          />
        </View>

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
  writeOne: { marginTop: space.md, alignSelf: "flex-start" },
});
