import { detectSourceKind } from "./source-kind.js";
import type { SourceKind } from "./recipe.js";

/**
 * Searching the open web for a recipe you don't have yet.
 *
 * Library search looks in your own collection and Discover looks at what other
 * Savortome cooks have shared. Both are closed worlds, so "chicken adobo" comes
 * back empty until somebody already put chicken adobo in one of them. This
 * module is the third place to look: the rest of the internet.
 *
 * A hit here is only a *candidate*. Nothing has been fetched, nothing has been
 * read, and no recipe exists yet — picking one runs it through the ordinary
 * import pipeline, which is what actually produces a Savortome recipe. Keeping
 * the two steps apart means the expensive half only happens for the one page
 * the cook chose.
 *
 * Deliberately free of the Anthropic SDK and Node built-ins: the clients render
 * these shapes, so they must be importable in a browser. The call that performs
 * the search lives in `web-search.ts`.
 */

/** One page the search turned up, before anything has been fetched. */
export interface WebRecipeHit {
  title: string;
  url: string;
  /** Hostname without "www.", for the "from seriouseats.com" line on the card. */
  host: string;
  /** So the UI can warn that a video import costs more than an article. */
  sourceKind: SourceKind;
  /** The search index's own age string ("3 days ago"), when it reports one. */
  pageAge: string | null;
}

export interface WebRecipeSearchResponse {
  query: string;
  hits: WebRecipeHit[];
  /**
   * Set when the search could not run at all — no API key, or the provider
   * refused. The UI shows this instead of pretending the web holds nothing.
   */
  unavailable?: string;
}

/** Long enough for "something korean with chicken and not much time", short enough to bound cost. */
export const WEB_RECIPE_QUERY_MAX = 120;
/** More than this is a wall of links, not a choice. */
export const WEB_RECIPE_LIMIT = 8;
/** One prolific blog must not fill the whole list. */
export const WEB_RECIPE_PER_HOST = 2;

/** Query params that identify a campaign rather than a page. Stripped so two links to one recipe dedupe. */
const TRACKING_PARAMS = /^(utm_|ref_|mc_|pk_|_hs|fbclid$|gclid$|msclkid$|igshid$|si$|yclid$)/i;

/**
 * Words that turn a leading number into a roundup ("25 Best Chicken Recipes")
 * rather than a real recipe ("5 Minute Pasta"). Checked together with the
 * number, never alone — plenty of good recipes are titled "Weeknight Meals".
 */
const ROUNDUP_NOUNS = /\b(recipes|ideas|ways|dishes|meals|dinners|desserts|snacks|favou?rites)\b/i;

/**
 * The cook's words, cleaned up enough to send somewhere. Returns null for
 * anything we shouldn't spend a search on rather than throwing, because an
 * empty box is a normal state, not an error.
 */
export function normalizeRecipeQuery(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // Control characters would travel into a prompt; collapse them with the
  // rest of the whitespace rather than passing them through.
  const cleaned = raw.replace(/\p{C}/gu, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length < 2) return null;
  return cleaned.slice(0, WEB_RECIPE_QUERY_MAX);
}

/** "https://www.seriouseats.com/x" gives "seriouseats.com". Empty string when unparseable. */
export function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/**
 * One canonical form per page, so the same recipe arriving from two searches
 * counts once. Returns null for anything that isn't a public-looking http(s)
 * link — the import pipeline's URL guard is still the real check, this only
 * keeps obvious junk out of the list.
 */
export function normalizeHitUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname.includes(".")) return null;

  // Rebuilt rather than mutated: React Native's URL polyfill types every part
  // as read-only, and this module is shared with the mobile app.
  const kept: string[] = [];
  url.searchParams.forEach((value, key) => {
    if (!TRACKING_PARAMS.test(key)) {
      kept.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
    }
  });

  // A trailing slash on a deep path is the same page; on the root it is the
  // conventional form. Normalizing only the former keeps both stable. The
  // fragment is dropped entirely — it never changes which page is fetched.
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname;
  return `${url.protocol}//${url.host}${path}${kept.length > 0 ? `?${kept.join("&")}` : ""}`;
}

/**
 * "25 Best Chicken Recipes" is a page of links, not something you can cook.
 * Importing one produces either a failure or a nonsense card, so it is worth
 * one cheap heuristic to keep them out of the list.
 *
 * Requires both a leading count and a roundup noun, so "5-Ingredient Chicken"
 * and "20 Minute Pasta" survive.
 */
export function isRoundupTitle(title: string): boolean {
  const t = title.trim();
  if (/^\d{1,3}\s+\S/.test(t) && ROUNDUP_NOUNS.test(t)) return true;
  return /\b(best|easy|favou?rite|top)\b[^.]{0,40}\b(recipes|ideas)\b/i.test(t);
}

/**
 * Turn whatever the search returned into the short, varied list a cook can
 * actually choose from: real pages only, one entry per page, at most a couple
 * from any one site, best first.
 *
 * Order is preserved rather than re-scored — the caller has already put these
 * in the order it wants, and inventing a ranking here would hide that.
 */
export function rankHits(
  raw: readonly { title: string; url: string; pageAge?: string | null }[],
  options: { limit?: number; perHost?: number } = {},
): WebRecipeHit[] {
  const limit = options.limit ?? WEB_RECIPE_LIMIT;
  const perHost = options.perHost ?? WEB_RECIPE_PER_HOST;

  const seen = new Set<string>();
  const hostCounts = new Map<string, number>();
  const hits: WebRecipeHit[] = [];

  for (const candidate of raw) {
    if (hits.length >= limit) break;

    const url = normalizeHitUrl(candidate.url ?? "");
    if (!url || seen.has(url)) continue;

    const title = (candidate.title ?? "").replace(/\s+/g, " ").trim();
    if (!title || isRoundupTitle(title)) continue;

    const host = hostLabel(url);
    if (!host) continue;
    const used = hostCounts.get(host) ?? 0;
    if (used >= perHost) continue;

    seen.add(url);
    hostCounts.set(host, used + 1);
    hits.push({
      title,
      url,
      host,
      sourceKind: detectSourceKind(url),
      pageAge: candidate.pageAge ?? null,
    });
  }

  return hits;
}
