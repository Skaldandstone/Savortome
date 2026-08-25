"use client";

import Link from "next/link";
import {
  NEARLY_THERE_LIMIT,
  describeMatch,
  formatMinutes,
  type PantrySearchResponse,
  type PantrySearchResult,
} from "@nomnom/core/format";
import { AddMissingButton } from "@/modules/list";
import styles from "./pantry.module.css";

function MatchRow({ match }: { match: PantrySearchResult }) {
  return (
    <li className={styles.matchRow}>
      <Link className={styles.match} href={`/recipe/${match.recipeId}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.thumb} src={match.imageUrl ?? undefined} alt="" />
        <span className={styles.matchText}>
          <strong>{match.title}</strong>
          <br />
          <span className={styles.matchMeta}>
            {[describeMatch(match), formatMinutes(match.totalMinutes)].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span
          className={styles.coverage}
          data-can-make={match.canMakeNow}
          title={`${match.have.length} of ${match.have.length + match.missing.length} ingredients`}
        >
          {match.canMakeNow ? "✓" : `${Math.round(match.coverage * 100)}%`}
        </span>
      </Link>
      {/* Sits outside the link: adding to the list isn't navigation. */}
      <AddMissingButton missing={match.missing} />
    </li>
  );
}

/**
 * Results split into what you can cook tonight, what you're a couple of items
 * away from, and everything else. The middle group is the useful one — it's
 * where "add one thing to the list" lives.
 */
export function MatchList({ results }: { results: PantrySearchResult[] }) {
  if (results.length === 0) {
    return <p className={styles.empty}>Nothing in your collection matches that yet.</p>;
  }

  const now = results.filter((r) => r.canMakeNow);
  const nearly = results.filter((r) => !r.canMakeNow && r.missing.length <= NEARLY_THERE_LIMIT);
  const rest = results.filter((r) => !r.canMakeNow && r.missing.length > NEARLY_THERE_LIMIT);

  return (
    <div className={styles.groups}>
      {now.length > 0 ? (
        <section>
          <h3 className={styles.groupHeading}>Cook tonight</h3>
          <ul className={styles.matches}>
            {now.map((m) => (
              <MatchRow key={m.recipeId} match={m} />
            ))}
          </ul>
        </section>
      ) : null}

      {nearly.length > 0 ? (
        <section>
          <h3 className={styles.groupHeading}>
            {now.length > 0 ? "Nearly there" : "Closest matches"}
          </h3>
          <ul className={styles.matches}>
            {nearly.map((m) => (
              <MatchRow key={m.recipeId} match={m} />
            ))}
          </ul>
        </section>
      ) : null}

      {rest.length > 0 ? (
        <details className={styles.rest}>
          <summary>{rest.length} more from your collection</summary>
          <ul className={styles.matches}>
            {rest.map((m) => (
              <MatchRow key={m.recipeId} match={m} />
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

/** Shows what the search actually understood, so a wrong result is explicable. */
export function QueryReadback({
  query,
  interpreted,
  usedPantry,
}: {
  query: PantrySearchResponse["query"];
  interpreted: boolean;
  usedPantry: boolean;
}) {
  const parts: string[] = [];

  if (query.ingredients.length > 0) {
    parts.push(`${usedPantry ? "your pantry" : "using"}: ${query.ingredients.join(", ")}`);
  }
  if (query.excludeIngredients.length > 0) parts.push(`without ${query.excludeIngredients.join(", ")}`);
  if (query.tags.length > 0) parts.push(query.tags.join(", "));
  if (query.maxMinutes) parts.push(`under ${query.maxMinutes} min`);
  if (query.course) parts.push(query.course);

  if (parts.length === 0) return null;

  return (
    <p className={styles.readback}>
      {interpreted ? "Searched for " : "Matching "}
      {parts.join(" · ")}
    </p>
  );
}
