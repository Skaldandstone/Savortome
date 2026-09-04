import type { SourceKind } from "./recipe.js";

/**
 * Pure URL classification, kept free of Node built-ins so the clients can
 * import it to label a pasted link before sending it anywhere.
 */

// `host.endsWith("youtube.com")` also matches "evilyoutube.com" or
// "notyoutube.com" - this requires an exact match or a genuine subdomain
// (a "." right before the suffix).
function hasDomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export function youtubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (!hasDomain(host, "youtube.com")) return null;
    if (u.pathname === "/watch") return u.searchParams.get("v");
    const m = /^\/(shorts|embed|live|v)\/([^/?#]+)/.exec(u.pathname);
    return m?.[2] ?? null;
  } catch {
    return null;
  }
}

export function socialKind(url: string): SourceKind | null {
  try {
    const h = new URL(url).hostname.replace(/^www\./, "").replace(/^m\./, "");
    if (hasDomain(h, "tiktok.com")) return "tiktok";
    if (hasDomain(h, "instagram.com") || hasDomain(h, "instagr.am")) return "instagram";
    if (hasDomain(h, "facebook.com") || hasDomain(h, "fb.watch")) return "facebook";
    return null;
  } catch {
    return null;
  }
}

export function detectSourceKind(url: string): SourceKind {
  if (youtubeVideoId(url)) return "youtube";
  return socialKind(url) ?? "web";
}
