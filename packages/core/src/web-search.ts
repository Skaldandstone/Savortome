import Anthropic from "@anthropic-ai/sdk";
import { normalizeRecipeQuery, rankHits, type WebRecipeHit } from "./web-recipes.js";
import {
  emitGenerationAudit,
  generatedContentSystem,
  generationAudit,
  type GenerationAuditSink,
} from "./generated-content.js";

/**
 * The web half of "find me a recipe".
 *
 * Claude runs the searches rather than us calling a search API directly, for
 * one reason: a cook types "something korean with chicken, nothing fiddly",
 * and that is not a search query. Turning it into two or three good ones is
 * the job, and it is the part a raw search endpoint cannot do.
 *
 * We read the search tool's own result blocks for titles and URLs — those are
 * facts from the index, not text the model wrote, so they cannot be
 * hallucinated. The model's prose is used only as a ranking signal: the URLs
 * it endorses go first. If that list is unparseable we fall back to index
 * order, so a chatty or truncated reply degrades instead of failing.
 *
 * Nothing here fetches a page. A hit is a candidate; importing it is a
 * separate, deliberate step that runs the ordinary pipeline.
 */

export const RECIPE_SEARCH_MODEL = "claude-opus-5";
export const RECIPE_SEARCH_PROMPT_VERSION = "savortome-web-recipe-search-v2";

/** Each search is billed, so the ceiling is part of the contract, not a tuning knob. */
export const MAX_SEARCHES = 3;

const SYSTEM = `You help a home cook find a recipe on the open web.

You will be given what the cook typed into a recipe app's search box. It may be a dish name, a craving, a set of ingredients, a constraint ("no oven", "20 minutes"), or a vague mood. Turn it into effective web searches and find pages the cook could actually cook from.

HOW TO SEARCH
- Run at most ${MAX_SEARCHES} searches. Start with the most direct phrasing of the dish; only search again if the first results are thin or clearly off-target.
- Add "recipe" to the query when the cook's words alone would return restaurants, products, or general articles.
- Respect stated constraints (diet, equipment, time, cuisine) in the query itself rather than hoping the results happen to match.

WHAT COUNTS AS A GOOD RESULT
- A single recipe on the page, with an ingredient list and steps.
- Prefer sources that publish a real recipe card: established food blogs, newspaper and magazine food sections, cooking schools, recipe sites.
- Reject roundups and listicles ("25 Best Weeknight Dinners"), product pages, forum threads, and pages that are mostly a story with no method.
- Variety matters: a cook wants a choice, not five versions of one blog's post. Prefer different sites over several pages from the same one.
- If the cook asked for a video, or the dish is one people learn by watching, a YouTube result is fine. Otherwise prefer written recipes — they import cleanly and cost the cook nothing.

YOUR REPLY
When you have finished searching, reply with nothing but the URLs you would actually hand the cook, best first, one per line. No numbering, no commentary, no markdown. If the searches turned up nothing worth cooking, reply with the single word NONE.`;

export class WebSearchError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "WebSearchError";
  }
}

export interface WebRecipeSearchOptions {
  client?: Anthropic;
  model?: string;
  /** Most hits to return; see WEB_RECIPE_LIMIT for the default. */
  limit?: number;
  /** Most hits from any one site. */
  perHost?: number;
  signal?: AbortSignal;
  onGenerationAudit?: GenerationAuditSink;
}

/** A raw index result, before ranking. Exported for the tests that drive the reader. */
export interface RawSearchResult {
  title: string;
  url: string;
  pageAge: string | null;
}

/**
 * Pull the index's results out of a response. Server-tool failures arrive as a
 * 200 with an error object where the result array would be, so the shape has
 * to be checked before it is indexed.
 */
export function readSearchResults(content: readonly unknown[]): {
  results: RawSearchResult[];
  errors: string[];
} {
  const results: RawSearchResult[] = [];
  const errors: string[] = [];

  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const b = block as { type?: unknown; content?: unknown };
    if (b.type !== "web_search_tool_result") continue;

    if (Array.isArray(b.content)) {
      for (const item of b.content) {
        if (!item || typeof item !== "object") continue;
        const r = item as { type?: unknown; title?: unknown; url?: unknown; page_age?: unknown };
        if (r.type !== "web_search_result") continue;
        if (typeof r.url !== "string" || typeof r.title !== "string") continue;
        results.push({
          title: r.title,
          url: r.url,
          pageAge: typeof r.page_age === "string" ? r.page_age : null,
        });
      }
    } else if (b.content && typeof b.content === "object") {
      const err = (b.content as { error_code?: unknown }).error_code;
      errors.push(typeof err === "string" ? err : "unknown_error");
    }
  }

  return { results, errors };
}

/**
 * The URLs the model put its name to, in its order. Tolerant on purpose: it
 * only looks for links, so a stray sentence or a truncated reply still yields
 * a usable ranking.
 */
export function readEndorsedUrls(content: readonly unknown[]): string[] {
  const urls: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    const b = block as { type?: unknown; text?: unknown };
    if (b.type !== "text" || typeof b.text !== "string") continue;
    for (const match of b.text.matchAll(/https?:\/\/[^\s<>"')\]]+/g)) {
      urls.push(match[0]);
    }
  }
  return urls;
}

/**
 * Put the endorsed pages first, keeping index order for everything else.
 * Matching is on the URL the index reported, so a model that reformats a link
 * simply loses its vote rather than injecting a page nobody searched for —
 * every returned hit still comes from the search index.
 */
export function orderByEndorsement(
  results: readonly RawSearchResult[],
  endorsed: readonly string[],
): RawSearchResult[] {
  if (endorsed.length === 0) return [...results];

  const rank = new Map<string, number>();
  endorsed.forEach((url, i) => {
    const key = url.replace(/[.,);]+$/, "");
    if (!rank.has(key)) rank.set(key, i);
  });

  return [...results].sort((a, b) => {
    const ra = rank.get(a.url) ?? Number.MAX_SAFE_INTEGER;
    const rb = rank.get(b.url) ?? Number.MAX_SAFE_INTEGER;
    if (ra !== rb) return ra - rb;
    return results.indexOf(a) - results.indexOf(b);
  });
}

/** Search the open web for recipe pages matching what the cook typed. */
export async function searchWebRecipes(
  rawQuery: string,
  options: WebRecipeSearchOptions = {},
): Promise<WebRecipeHit[]> {
  const query = normalizeRecipeQuery(rawQuery);
  if (!query) return [];

  const client = options.client ?? new Anthropic();
  const model = options.model ?? RECIPE_SEARCH_MODEL;

  let response;
  try {
    response = await client.messages.create(
      {
        model,
        // The prose reply is a short list of links. The ceiling is for the
        // thinking and the tool round trips, not the answer.
        max_tokens: 4_000,
        system: [{
          type: "text",
          text: generatedContentSystem(SYSTEM, RECIPE_SEARCH_PROMPT_VERSION),
          cache_control: { type: "ephemeral", ttl: "1h" },
        }],
        // Picking good search terms is not hard reasoning, and this call sits
        // directly in front of someone waiting at a search box.
        output_config: { effort: "low" },
        tools: [{ type: "web_search_20260209", name: "web_search", max_uses: MAX_SEARCHES }],
        messages: [{ role: "user", content: `The cook typed: ${query}` }],
      },
      { signal: options.signal },
    );
  } catch (err) {
    emitGenerationAudit(options.onGenerationAudit, generationAudit(
      RECIPE_SEARCH_PROMPT_VERSION, model, "recipe-search-query-v1", "rejected",
    ));
    throw new WebSearchError(
      err instanceof Error ? err.message : "The web search could not be run.",
      err,
    );
  }

  const { results, errors } = readSearchResults(response.content);
  if (results.length === 0 && errors.length > 0) {
    emitGenerationAudit(options.onGenerationAudit, generationAudit(
      RECIPE_SEARCH_PROMPT_VERSION, model, "recipe-search-query-v1", "rejected", response,
    ));
    throw new WebSearchError(`The search provider refused the request (${errors.join(", ")}).`);
  }

  const ordered = orderByEndorsement(results, readEndorsedUrls(response.content));
  const hits = rankHits(ordered, { limit: options.limit, perHost: options.perHost });
  emitGenerationAudit(options.onGenerationAudit, generationAudit(
    RECIPE_SEARCH_PROMPT_VERSION,
    model,
    "recipe-search-query-v1",
    readEndorsedUrls(response.content).length > 0 ? "passed" : "fallback",
    response,
  ));
  return hits;
}
