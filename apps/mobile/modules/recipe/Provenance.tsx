import { StyleSheet, Text, View } from "react-native";
import { provenanceTone, type ExtractionMethod, type Recipe } from "@seconds/core/format";
import { Callout, space, type as typeScale, usePalette } from "@/ui";

const METHOD_LABEL: Record<ExtractionMethod, string> = {
  "schema-org": "Read directly from the site's own recipe data",
  "article-llm": "Reconstructed from the article text",
  "transcript-llm": "Reconstructed from what was said in the video",
  "caption-llm": "Reconstructed from the post caption",
  "photo-llm": "Reconstructed from a photo of the page",
  manual: "Written by hand",
};

/**
 * Where this card came from and how much of it we had to infer. This is the
 * difference between a recipe you trust and one you check against the source,
 * so it stays visible rather than hiding behind a toggle.
 */
export function Provenance({
  recipe,
  /** When someone last read this card through and saved it. */
  verifiedAt = null,
}: {
  recipe: Recipe;
  verifiedAt?: string | null;
}) {
  const c = usePalette();
  const { extractionMethod } = recipe.source;
  // Nothing was extracted from a recipe someone typed, so there's no score to
  // report and nothing for them to have double-checked.
  const written = extractionMethod === "manual";
  const inferred = !written && extractionMethod !== "schema-org";
  const tone = provenanceTone(recipe.confidence, recipe.extractionNotes.length, verifiedAt);
  const color = tone === "needs-review" ? c.warn : c.textMuted;

  return (
    <Callout
      tone={tone === "needs-review" ? "warn" : "info"}
      title={METHOD_LABEL[extractionMethod]}
    >
      <View>
        {inferred ? (
          <Text style={[styles.body, { color }]}>
            {Math.round(recipe.confidence * 100)}% of this was stated outright.
          </Text>
        ) : null}

        {/* Once a person has been through it, what we had to guess is history
            rather than a warning — so it's still listed, just not shouted. */}
        {tone === "verified" && !written ? (
          <Text style={[styles.body, { color }]}>You&apos;ve checked this one over.</Text>
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
