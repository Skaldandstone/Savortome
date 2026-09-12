"use client";

import { Button, Callout, FieldRow, Panel, PanelHeader, TextField } from "@/ui";
import { DiscoverCards } from "./DiscoverCards";
import { useDiscover } from "./useDiscover";
import { WebRecipeFinder } from "./WebRecipeFinder";
import styles from "./discover.module.css";

/** Browse and search what other people have shared. */
export function DiscoverPanel() {
  const { data, loading, error, query, searchedQuery, activeTags, setQuery, search, toggleTag } =
    useDiscover();

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
            {error}
          </Callout>
        ) : null}
      </Panel>

      <section
        className={styles.results}
        aria-label="Shared recipe results"
        aria-busy={loading}
        aria-live="polite"
      >
        {loading ? (
          <p className={styles.empty} role="status">
            Looking for shared recipes…
          </p>
        ) : data.recipes.length === 0 ? (
          <>
            <p className={styles.empty}>
              {searchedQuery || activeTags.length > 0
                ? "Nothing shared matches that yet."
                : "No one has shared anything yet. Set one of your recipes to “Anyone with the link” and it turns up here."}
            </p>
            <WebRecipeFinder query={searchedQuery} />
          </>
        ) : (
          <DiscoverCards cards={data.recipes} />
        )}
      </section>
    </>
  );
}
