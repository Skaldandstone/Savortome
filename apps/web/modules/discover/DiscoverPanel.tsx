"use client";

import { Button, Callout, FieldRow, Panel, PanelHeader, TextField } from "@/ui";
import { DiscoverCards } from "./DiscoverCards";
import { useDiscover, type DiscoverController } from "./useDiscover";
import { WebRecipeFinder } from "./WebRecipeFinder";
import styles from "./discover.module.css";

/** Browse and search what other people have shared. */
export function DiscoverPanel() {
  return <DiscoverPanelView discover={useDiscover()} />;
}

export function DiscoverPanelView({ discover }: { discover: DiscoverController }) {
  const { data, loading, loaded, error, query, searchedQuery, activeTags, setQuery, search, toggleTag, retry } =
    discover;

  return (
    <>
      <Panel>
        <PanelHeader
          title="Discover"
          hint="Recipes other people have shared. Search by name, cuisine, or what it is."
        />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void search(query);
          }}
        >
          <FieldRow>
            <TextField
              aria-label="Search shared recipes"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="kimchi, one-pan, something Korean…"
              disabled={loading}
            />
            <Button type="submit" disabled={loading}>
              Search
            </Button>
          </FieldRow>
        </form>

        {data.tags.length > 0 ? (
          <div className={styles.tags}>
            {data.tags.map(({ tag, count }) => (
              <button
                key={tag}
                type="button"
                className={styles.tag}
                aria-pressed={activeTags.includes(tag)}
                disabled={loading}
                onClick={() => void toggleTag(tag)}
              >
                {tag}
                <span className={styles.tagCount}>{count}</span>
              </button>
            ))}
          </div>
        ) : null}

        {error ? (
          <Callout tone="error" role="alert">
            {loaded
              ? "Shared recipes could not refresh. The last results we loaded remain below."
              : "Shared recipes could not load. No empty result has been assumed."}{" "}
            <Button type="button" variant="ghost" onClick={() => void retry()}>Try again</Button>
          </Callout>
        ) : null}
      </Panel>

      <section
        className={styles.results}
        aria-label="Shared recipe results"
        aria-busy={loading}
        aria-live="polite"
      >
        {loading && loaded ? (
          <p className={styles.empty} role="status">Refreshing shared recipes…</p>
        ) : null}
        {loading && !loaded ? (
          <p className={styles.empty} role="status">
            Looking for shared recipes…
          </p>
        ) : !loaded ? null : data.recipes.length === 0 ? (
          <>
            <p className={styles.empty}>
              {error
                ? "The last shared-recipe results we loaded were empty."
                : searchedQuery || activeTags.length > 0
                ? "Nothing shared matches that yet."
                : "No one has shared anything yet. Set one of your recipes to “Anyone with the link” and it turns up here."}
            </p>
            {!error ? <WebRecipeFinder query={searchedQuery} /> : null}
          </>
        ) : (
          <DiscoverCards cards={data.recipes} />
        )}
      </section>
    </>
  );
}
