import { StyleSheet, Text, View } from "react-native";
import type { ExtractionMethod, Recipe } from "@nomnom/core/format";
import { Callout, space, type as typeScale, usePalette } from "@/ui";

const METHOD_LABEL: Record<ExtractionMethod, string> = {
  "schema-org": "Read directly from the site's own recipe data",
  "article-llm": "Reconstructed from the article text",
  "transcript-llm": "Reconstructed from what was said in the video",
  "caption-llm": "Reconstructed from the post caption",
  manual: "Written by hand",
};

/**
 * Where this card came from and how much of it we had to infer. This is the
 * difference between a recipe you trust and one you check against the source,
 * so it stays visible rather than hiding behind a toggle.
 */
export function Provenance({ recipe }: { recipe: Recipe }) {
  const c = usePalette();
  const { extractionMethod } = recipe.source;
  const inferred = extractionMethod !== "schema-org";
  const needsReview = recipe.confidence < 0.8 || recipe.extractionNotes.length > 0;
  const color = needsReview ? c.warn : c.textMuted;

  return (
    <Callout tone={needsReview ? "warn" : "info"} title={METHOD_LABEL[extractionMethod]}>
      <View>
        {inferred ? (
          <Text style={[styles.body, { color }]}>
            {Math.round(recipe.confidence * 100)}% of this was stated outright.
          </Text>
        ) : null}
        {recipe.extractionNotes.map((note) => (
          <Text key={note} style={[styles.note, { color }]}>
            • {note}
          </Text>
        ))}
      </View>
    </Callout>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: typeScale.small, lineHeight: 19 },
  note: { fontSize: typeScale.small, lineHeight: 19, marginTop: space.xs },
});
