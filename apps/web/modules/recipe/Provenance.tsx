import { provenanceTone, type ExtractionMethod, type Recipe } from "@seconds/core/format";
import { Callout } from "@/ui";
import styles from "./Provenance.module.css";

const METHOD_LABEL: Record<ExtractionMethod, string> = {
  "schema-org": "Read directly from the site's own recipe data",
  "article-llm": "Reconstructed from the article text",
  "transcript-llm": "Reconstructed from what was said in the video",
  "caption-llm": "Reconstructed from the post caption",
  "photo-llm": "Reconstructed from a photo of the page",
  manual: "Written by hand",
  "file-import": "Imported from another recipe app's own export",
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
  const { extractionMethod } = recipe.source;
  // Nothing was extracted from a recipe someone typed, so there's no score to
  // report and nothing for them to have double-checked.
  const written = extractionMethod === "manual";
  // Nothing was guessed on a deterministic path either — a page's own JSON-LD
  // and another app's own export are both read directly, not reconstructed.
  const deterministic = extractionMethod === "schema-org" || extractionMethod === "file-import";
  const inferred = !written && !deterministic;
  const tone = provenanceTone(recipe.confidence, recipe.extractionNotes.length, verifiedAt);

  return (
    <Callout
      tone={tone === "needs-review" ? "warn" : "info"}
      title={METHOD_LABEL[extractionMethod]}
    >
      {inferred ? <>{Math.round(recipe.confidence * 100)}% of this was stated outright.</> : null}

      {/* Once a person has been through it, what we had to guess is history
          rather than a warning — so it's still listed, just not shouted. */}
      {tone === "verified" && !written ? <> You&apos;ve checked this one over.</> : null}

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
