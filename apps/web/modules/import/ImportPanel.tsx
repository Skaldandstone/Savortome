"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CREDIT_PACKS, type CreditBalance, type CreditPack } from "@seconds/core/format";
import { RecipeCard } from "@/modules/recipe";
import { Callout, Panel, PanelHeader } from "@/ui";
import { CreditMeter } from "./CreditMeter";
import { ImportForm } from "./ImportForm";
import { ImportProgress } from "./ImportProgress";
import { useImport } from "./useImport";

/** The app's front door: paste something, get a recipe card. */
export function ImportPanel() {
  const { stage, busy, error, result, run } = useImport();
  const [credits, setCredits] = useState<CreditBalance | null>(null);
  const [resetsOn, setResetsOn] = useState<string>("");
  const [packs, setPacks] = useState<CreditPack[]>(CREDIT_PACKS);

  // Fetched once so the count is on screen before anything is pasted. A 401 or
  // 501 just means there's nothing to meter, which is not an error worth showing.
  useEffect(() => {
    fetch("/api/credits")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.credits) setCredits(d.credits);
        if (d?.resetsOn) setResetsOn(d.resetsOn);
        if (d?.packs) setPacks(d.packs);
      })
      .catch(() => undefined);
  }, []);

  // Every import answers with the balance that follows it, so the count stays
  // right without a second round trip.
  useEffect(() => {
    if (result?.credits) setCredits(result.credits);
  }, [result]);

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

        {credits ? <CreditMeter balance={credits} resetsOn={resetsOn} packs={packs} /> : null}

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
