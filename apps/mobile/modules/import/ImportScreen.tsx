import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RecipeCard } from "@/modules/recipe";
import { Button, Callout, Panel, PanelHeader, space, usePalette } from "@/ui";
import { ImportForm } from "./ImportForm";
import { ImportProgress } from "./ImportProgress";
import { api } from "@/lib/client";
import { apiBaseUrl } from "@/lib/api";
import type { CreditsResponse } from "@seconds/core/format";
import { CreditMeter } from "./CreditMeter";
import { useImport } from "./useImport";

/** The app's front door: paste something, get a recipe card. */
export function ImportScreen() {
  const { stage, busy, error, result, run } = useImport();
  const [credits, setCredits] = useState<CreditsResponse | null>(null);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const c = usePalette();

  // Fetched once so the count is on screen before anything is pasted. Signed
  // out or unconfigured just means there's nothing to meter.
  useEffect(() => {
    api.credits().then(setCredits).catch(() => undefined);
  }, []);

  // Each import answers with the balance that follows it, so the count stays
  // right without a second round trip.
  useEffect(() => {
    if (result?.credits) {
      setCredits((prev) => (prev ? { ...prev, credits: result.credits! } : prev));
    }
  }, [result]);

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

        {credits ? (
          <CreditMeter
            balance={credits.credits}
            resetsOn={credits.resetsOn}
            packs={credits.packs}
            webUrl={apiBaseUrl()}
          />
        ) : null}

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
