import { NextResponse } from "next/server";
import {
  normalizeRecipeQuery,
  searchWebRecipes,
  WebSearchError,
  type WebRecipeSearchResponse,
} from "@seconds/core";
import { db } from "@seconds/db";
import { errorResponse } from "@/lib/api";
import { databaseConfigured, requireUserId } from "@/lib/session";
import { recordGenerationAudit } from "@/lib/generation-audit";

/**
 * Recipe pages from the open web, for the moment your collection and the
 * shared library both come up empty.
 *
 * Signed-in only. Unlike /api/discover — which is deliberately readable signed
 * out, because discovery you have to sign up for isn't discovery — every call
 * here spends money with a search provider, so it needs an account behind it.
 * It does not spend a credit: the credit meter pays for extraction, and this
 * endpoint only produces links. The cost lands later, and only if the cook
 * picks one, when /api/import runs the pipeline on that page.
 *
 * A failure answers 200 with `unavailable` rather than an error status. The
 * caller is a search box with results already on screen; "the web search
 * couldn't run, here's why" belongs in the panel, not in a thrown request.
 */
export const runtime = "nodejs";
// Several searches plus the model's reading of them. Comfortably longer than
// the usual few seconds, well short of the import pipeline's five minutes.
export const maxDuration = 60;

export async function GET(request: Request) {
  if (databaseConfigured()) {
    try {
      await requireUserId(db());
    } catch (err) {
      return errorResponse(err);
    }
  }

  const raw = new URL(request.url).searchParams.get("q") ?? "";
  const query = normalizeRecipeQuery(raw);
  if (!query) {
    return NextResponse.json<WebRecipeSearchResponse>({ query: "", hits: [] });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json<WebRecipeSearchResponse>({
      query,
      hits: [],
      unavailable:
        "Searching the web needs an Anthropic API key. Set ANTHROPIC_API_KEY to turn this on.",
    });
  }

  try {
    return NextResponse.json<WebRecipeSearchResponse>({
      query,
      hits: await searchWebRecipes(query, { onGenerationAudit: recordGenerationAudit }),
    });
  } catch (err) {
    if (err instanceof WebSearchError) {
      return NextResponse.json<WebRecipeSearchResponse>({
        query,
        hits: [],
        unavailable: err.message,
      });
    }
    return errorResponse(err);
  }
}
