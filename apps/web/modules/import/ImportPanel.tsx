"use client";

import Link from "next/link";
import { RecipeCard } from "@/modules/recipe";
import { Callout, Panel, PanelHeader } from "@/ui";
import { ImportForm } from "./ImportForm";
import { ImportProgress } from "./ImportProgress";
import { useImport } from "./useImport";

/** The app's front door: paste something, get a recipe card. */
export function ImportPanel() {
  const { stage, busy, error, result, run } = useImport();

  return (
    <>
      <Panel>
        <PanelHeader
          title="Import a recipe"
          hint={
            <>
              Paste a link to a YouTube video, TikTok, Reel, or a blog post buried under a life
              story — or <Link href="/recipe/new">write one yourself</Link>.
            </>
          }
        />

        <ImportForm busy={busy} onSubmit={run} />

        {stage !== null ? <ImportProgress stage={stage} /> : null}

        {error ? (
          <Callout tone="error" title="Couldn't import that" role="alert">
            {error.message}
            {error.trace?.length ? <pre>{error.trace.join("\n")}</pre> : null}
          </Callout>
        ) : null}

        {result?.saveError ? (
          <Callout tone="error" title="Extracted, but not saved">
            {result.saveError}
          </Callout>
        ) : null}
      </Panel>

      {result ? (
        <RecipeCard
          recipe={result.recipe}
          trace={result.trace}
          shelvedId={result.saved ? result.recipe.id : null}
        />
      ) : null}
    </>
  );
}
