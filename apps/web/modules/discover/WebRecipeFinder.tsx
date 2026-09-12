"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ApiError, type WebRecipeHit } from "@seconds/core/format";
import { api } from "@/lib/client";
import { Button, Callout } from "@/ui";
import styles from "./web-finder.module.css";

/**
 * The way out of an empty search.
 *
 * Your collection and the shared library are both closed worlds, so a dish
 * neither contains is a dead end — the old copy said "try another search",
 * which is advice, not help. This looks in the third place: the open web.
 *
 * Searching is one deliberate click rather than something that fires with the
 * page. Every run costs the business money at a search provider, and a cook
 * who found what they wanted in their own shelves should never trigger one.
 *
 * Picking a result runs the ordinary import pipeline, so what lands in the
 * kitchen is a real Savortome recipe — ingredients parsed, steps numbered,
 * pantry keys canonicalized — not a bookmark.
 */
export function WebRecipeFinder({ query }: { query: string }) {
  const [hits, setHits] = useState<WebRecipeHit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const search = useCallback(async () => {
    setSearching(true);
    setNotice(null);
    setHits(null);
    try {
      const response = await api.searchWeb(query);
      setHits(response.hits);
      if (response.unavailable) setNotice(response.unavailable);
    } catch (err) {
      setNotice(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : "The web search didn't run.",
      );
    } finally {
      setSearching(false);
    }
  }, [query]);

  if (!query.trim()) return null;

  return (
    <section className={styles.finder} aria-labelledby="web-finder-heading">
      <h3 id="web-finder-heading" className={styles.heading}>
        Not in your kitchen yet
      </h3>
      <p className={styles.lede}>
        Nothing here matches “{query}”. Look for it on the web, and bring back whichever one you
        like as a proper recipe.
      </p>

      <Button type="button" onClick={() => void search()} disabled={searching}>
        {searching ? "Searching the web…" : `Search the web for “${query}”`}
      </Button>

      {notice ? (
        <Callout tone="warn" role="status">
          {notice}
        </Callout>
      ) : null}

      {searching ? (
        <p className={styles.status} role="status">
          Looking through recipe sites. This takes a few seconds.
        </p>
      ) : null}

      {hits && hits.length === 0 && !notice ? (
        <p className={styles.status}>
          The web didn’t turn up a recipe for that either. A different wording often helps — a dish
          name works better than a description.
        </p>
      ) : null}

      {hits && hits.length > 0 ? (
        <ul className={styles.hits} aria-label="Recipes found on the web">
          {hits.map((hit) => (
            <WebHitRow key={hit.url} hit={hit} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

type RowState =
  | { kind: "idle" }
  | { kind: "importing" }
  | { kind: "done"; recipeId: string | null; free: boolean }
  | { kind: "failed"; message: string };

/**
 * One candidate page, and the single button that turns it into a recipe.
 *
 * Each row owns its own request so a slow or failing import never blocks the
 * others — you can start two and keep reading.
 */
function WebHitRow({ hit }: { hit: WebRecipeHit }) {
  const [state, setState] = useState<RowState>({ kind: "idle" });

  const bring = useCallback(async () => {
    setState({ kind: "importing" });
    try {
      const result = await api.importRecipe({ url: hit.url });
      setState({
        kind: "done",
        // Saved recipes carry the stored id; without a database the card is
        // still returned, so the row succeeds without a link to follow.
        recipeId: result.saved ? result.recipe.id : null,
        free: result.freeExtraction,
      });
    } catch (err) {
      setState({
        kind: "failed",
        message:
          err instanceof ApiError || err instanceof Error
            ? err.message
            : "That page couldn't be imported.",
      });
    }
  }, [hit.url]);

  return (
    <li className={styles.hit}>
      <div className={styles.hitBody}>
        <a className={styles.hitTitle} href={hit.url} target="_blank" rel="noreferrer noopener">
          {hit.title}
        </a>
        <p className={styles.hitMeta}>
          <span className={styles.host}>{hit.host}</span>
          {hit.sourceKind !== "web" ? (
            <span className={styles.badge}>{hit.sourceKind}</span>
          ) : null}
          {hit.pageAge ? <span className={styles.age}>{hit.pageAge}</span> : null}
        </p>
        {state.kind === "failed" ? (
          <p className={styles.failed} role="alert">
            {state.message}
          </p>
        ) : null}
        {state.kind === "done" && state.free ? (
          <p className={styles.free}>The site published its own recipe data, so this was free.</p>
        ) : null}
      </div>

      <div className={styles.hitAction}>
        {state.kind === "done" ? (
          state.recipeId ? (
            <Link className={styles.openLink} href={`/recipe/${state.recipeId}`}>
              Open it
            </Link>
          ) : (
            <span className={styles.doneLabel}>Brought in</span>
          )
        ) : (
          <Button
            type="button"
            variant="ghost"
            onClick={() => void bring()}
            disabled={state.kind === "importing"}
          >
            {state.kind === "importing"
              ? "Reading…"
              : state.kind === "failed"
                ? "Try again"
                : "Bring it in"}
          </Button>
        )}
      </div>
    </li>
  );
}
