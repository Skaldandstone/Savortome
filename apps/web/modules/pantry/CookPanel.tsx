"use client";

import { useState } from "react";
import Link from "next/link";
import { signInReturnHref } from "@/lib/action-failure";
import { Button, Callout, FieldRow, Panel, PanelHeader, TextField } from "@/ui";
import { MatchList, QueryReadback } from "./MatchList";
import { PantryList } from "./PantryList";
import { usePantry, usePantrySearch } from "./usePantry";
import styles from "./pantry.module.css";
import { PantryReviewQueue } from "./PantryReviewQueue";

const EXAMPLES = [
  "chicken thighs, rice, an onion",
  "something quick and vegetarian",
  "dinner without dairy",
];

/**
 * "What can I make?" — the search box, the saved pantry behind it, and the
 * ranked answer.
 *
 * Searching with an empty box deliberately falls back to the saved pantry, so
 * the common case is one tap rather than retyping the same ingredients.
 */
export function CookPanel() {
  const pantry = usePantry();
  const { response, searching, error, search } = usePantrySearch();
  const [query, setQuery] = useState("");
  const [showPantry, setShowPantry] = useState(false);

  const canSearchPantry = pantry.items.length > 0;

  return (
    <>
      <Panel>
        <PanelHeader
          title="What can I make?"
          hint="List what you have, or just describe what you're after. Basic seasonings, oils, and baking staples are assumed by name — add anything else you keep stocked to your pantry."
        />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void search(query);
          }}
        >
          <FieldRow>
            <TextField
              aria-label="Ingredients or recipe preferences"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                canSearchPantry
                  ? "Leave blank to use your pantry, or type what you have"
                  : "chicken thighs, rice, an onion"
              }
              disabled={searching}
            />
            <Button type="submit" disabled={searching}>
              {searching ? "Looking…" : "Find recipes"}
            </Button>
          </FieldRow>
        </form>

        <div className={styles.examples}>
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              className={styles.example}
              disabled={searching}
              onClick={() => {
                setQuery(example);
                void search(example);
              }}
            >
              {example}
            </button>
          ))}
        </div>

        <div className={styles.pantryToggle}>
          <Button variant="ghost" type="button" onClick={() => setShowPantry((v) => !v)}>
            {showPantry ? "Hide my pantry" : `My pantry${canSearchPantry ? ` (${pantry.items.length})` : ""}`}
          </Button>
        </div>

        {showPantry ? (
          <div className={styles.pantryPanel}>
            {pantry.loading && !pantry.loaded ? (
              <p className={styles.empty} role="status">
                Loading pantry…
              </p>
            ) : pantry.loaded ? (
              <PantryList
                items={pantry.items}
                onAdd={pantry.add}
                onUpdate={pantry.update}
                onRemove={pantry.remove}
                onClear={pantry.clear}
              />
            ) : null}
            {pantry.pantryError ? (
              <Callout tone="error" role="alert">
                {pantry.loaded
                  ? "Your pantry could not refresh. The last pantry we loaded remains available above."
                  : "Your pantry could not load. Your saved items have not changed."}{" "}
                <Button type="button" variant="ghost" onClick={pantry.retryPantry}>Try pantry again</Button>
              </Callout>
            ) : null}
            {pantry.intakesLoading && !pantry.intakesLoaded ? (
              <p className={styles.empty} role="status">Checking for groceries to review…</p>
            ) : null}
            {pantry.intakesLoaded ? <PantryReviewQueue intakes={pantry.intakes} onResolve={pantry.resolveIntake} /> : null}
            {pantry.intakesError ? (
              <Callout tone="error" role="alert">
                {pantry.intakesLoaded
                  ? "Recent grocery reviews could not refresh. The last reviews we loaded remain available above."
                  : "Recent grocery reviews could not load. Your pantry is still available."}{" "}
                <Button type="button" variant="ghost" onClick={pantry.retryIntakes}>Try grocery reviews again</Button>
              </Callout>
            ) : null}
            {pantry.error ? (
              <Callout tone="error" role="alert">
                {pantry.error.message}
                {pantry.error.signInRequired ? <> <Link href={signInReturnHref("/")}>Sign in again</Link>.</> : null}
              </Callout>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <Callout tone="error" title="Search failed" role="alert">
            {error.message}
            {error.signInRequired ? <> <Link href={signInReturnHref("/")}>Sign in again</Link>.</> : null}
          </Callout>
        ) : null}

        {response?.note ? <Callout tone="info">{response.note}</Callout> : null}
      </Panel>

      {response ? (
        <section className={styles.results} aria-label="Pantry recipe results" aria-live="polite">
          <QueryReadback
            query={response.query}
            interpreted={response.interpreted}
            usedPantry={response.usedPantry}
          />
          <MatchList results={response.results} />
        </section>
      ) : null}
    </>
  );
}
