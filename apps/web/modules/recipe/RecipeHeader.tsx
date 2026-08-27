import type { Recipe } from "@seconds/core/format";
import styles from "./RecipeHeader.module.css";

export function RecipeHeader({ recipe }: { recipe: Recipe }) {
  const { source } = recipe;
  // Many blogs set author and site name to the same string; print it once.
  const siteLabel = source.siteName === source.author ? null : (source.siteName ?? source.kind);

  return (
    <header>
      <h2 className={styles.title}>{recipe.title}</h2>
      {recipe.description ? <p className={styles.lede}>{recipe.description}</p> : null}
      <p className={styles.attribution}>
        {source.author ? <>By {source.author}</> : null}
        {source.author && (siteLabel || source.url) ? " · " : null}
        {source.url ? (
          <a href={source.url} target="_blank" rel="noreferrer noopener">
            {siteLabel ?? "View source"}
          </a>
        ) : (
          siteLabel
        )}
      </p>
    </header>
  );
}

/** Full-bleed image from whatever site the recipe came from. */
export function RecipeHero({ imageUrl }: { imageUrl: string | null }) {
  if (!imageUrl) return null;
  // Sources are arbitrary third-party hosts, so this stays a plain <img>
  // rather than going through the image optimizer.
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={styles.hero} src={imageUrl} alt="" />;
}
