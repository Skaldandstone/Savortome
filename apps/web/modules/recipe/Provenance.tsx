import type { ExtractionMethod, Recipe } from "@nomnom/core/format";
import { Callout } from "@/ui";
import styles from "./Provenance.module.css";

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
  const { extractionMethod } = recipe.source;
  const inferred = extractionMethod !== "schema-org";
  const needsReview = recipe.confidence < 0.8 || recipe.extractionNotes.length > 0;

  return (
    <Callout tone={needsReview ? "warn" : "info"} title={METHOD_LABEL[extractionMethod]}>
      {inferred ? <>{Math.round(recipe.confidence * 100)}% of this was stated outright.</> : null}
      {recipe.extractionNotes.length > 0 ? (
        <ul>
          {recipe.extractionNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
    </Callout>
  );
}

/** Collapsed record of which resolver ran and whether a model call was needed. */
export function ImportTrace({ trace }: { trace?: string[] }) {
  if (!trace?.length) return null;
  return (
    <details className={styles.trace}>
      <summary>How this import ran</summary>
      <ul>
        {trace.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
    </details>
  );
}
